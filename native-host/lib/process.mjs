// @ts-check
/**
 * Spawning and stopping CLI processes. Children never get a shell, always
 * get piped stdio (stdout is reserved for native messaging frames) and run in
 * their own process group on POSIX so the whole tree can be signalled.
 */
import { spawn } from 'node:child_process';
import { basename } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { HostError } from './errors.mjs';

/** Wait between SIGINT -> SIGTERM -> SIGKILL. */
export const KILL_GRACE_MS = 5000;
/** Default cap on buffered stdout when no onStdout callback is given. */
const DEFAULT_MAX_STDOUT_BYTES = 4 * 1024 * 1024;
/** Only the end of stderr is kept, for error classification. */
const STDERR_TAIL_CHARS = 4096;

/**
 * @typedef {object} RunOptions
 * @property {string} command Absolute path of the executable.
 * @property {string[]} args
 * @property {string} cwd
 * @property {Record<string, string>} env Complete child environment.
 * @property {string} [input] Written to stdin, which is then closed.
 * @property {AbortSignal} [signal] Aborting stops the process tree; the run
 *   then rejects with `signal.reason` once the process has exited.
 * @property {(chunk: Buffer) => void} [onStdout] Streams stdout instead of
 *   buffering it.
 * @property {number} [maxStdoutBytes]
 * @property {NodeJS.Platform} [platform]
 * @property {number} [graceMs]
 */

/**
 * @typedef {object} RunResult
 * @property {number | null} exitCode
 * @property {string} stdout Empty when onStdout was given.
 * @property {string} stderrTail Last few KB of stderr.
 */

/** @typedef {(options: RunOptions) => Promise<RunResult>} RunCli */

/** @type {RunCli} */
export function runCli(options) {
  const {
    command,
    args,
    cwd,
    env,
    input,
    signal,
    onStdout,
    maxStdoutBytes = DEFAULT_MAX_STDOUT_BYTES,
    platform = process.platform,
    graceMs = KILL_GRACE_MS,
  } = options;

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }

    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: platform !== 'win32',
      windowsHide: true,
    });

    /** @type {Buffer[]} */
    const stdoutChunks = [];
    let stdoutBytes = 0;
    let overflowed = false;
    const stderrDecoder = new StringDecoder('utf8');
    let stderrTail = '';
    let settled = false;

    const stop = () => terminateTree(child, { platform, graceMs });
    const onAbort = () => stop();
    signal?.addEventListener('abort', onAbort, { once: true });

    /** @param {() => void} finish */
    const settle = (finish) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      finish();
    };

    child.stdout.on('data', (/** @type {Buffer} */ chunk) => {
      if (onStdout) {
        onStdout(chunk);
        return;
      }
      stdoutBytes += chunk.length;
      if (stdoutBytes > maxStdoutBytes) {
        if (!overflowed) {
          overflowed = true;
          stop();
        }
        return;
      }
      stdoutChunks.push(chunk);
    });

    child.stderr.on('data', (/** @type {Buffer} */ chunk) => {
      stderrTail = (stderrTail + stderrDecoder.write(chunk)).slice(
        -STDERR_TAIL_CHARS
      );
    });

    child.on('error', (error) => {
      const code = /** @type {NodeJS.ErrnoException} */ (error).code ?? 'error';
      settle(() =>
        reject(
          new HostError(
            'cli_not_found',
            `cannot start ${basename(command)} (${code}); re-run install.mjs`
          )
        )
      );
    });

    child.on('close', (exitCode) => {
      settle(() => {
        if (signal?.aborted) reject(signal.reason);
        else if (overflowed) {
          reject(
            new HostError(
              'bad_output',
              `${basename(command)} wrote more than ${maxStdoutBytes} bytes`
            )
          );
        } else {
          resolve({
            exitCode,
            stdout: Buffer.concat(stdoutChunks).toString('utf8'),
            stderrTail: (stderrTail + stderrDecoder.end()).slice(
              -STDERR_TAIL_CHARS
            ),
          });
        }
      });
    });

    // A child that exits early closes its stdin; ignore the resulting EPIPE.
    child.stdin.on('error', () => {});
    child.stdin.end(input ?? '');
  });
}

/**
 * @typedef {object} KillableChild
 * @property {number} [pid]
 * @property {number | null} exitCode
 * @property {NodeJS.Signals | null} signalCode
 * @property {(signal?: NodeJS.Signals) => boolean} kill
 * @property {(event: 'exit', listener: () => void) => unknown} once
 */

/**
 * @typedef {object} TerminateOptions
 * @property {NodeJS.Platform} [platform]
 * @property {number} [graceMs]
 * @property {(pid: number, signal: NodeJS.Signals) => void} [killGroup]
 * @property {(pid: number) => void} [killWindowsTree]
 */

/**
 * Stop a child and everything it spawned. POSIX: SIGINT, then SIGTERM and
 * SIGKILL `graceMs` apart, sent to the child's process group. Windows:
 * `taskkill /T /F` on the tree.
 * @param {KillableChild} child
 * @param {TerminateOptions} [options]
 */
export function terminateTree(child, options = {}) {
  const {
    platform = process.platform,
    graceMs = KILL_GRACE_MS,
    killGroup = (pid, sig) => process.kill(-pid, sig),
    killWindowsTree = taskkill,
  } = options;
  const exited = () => child.exitCode !== null || child.signalCode !== null;
  const pid = child.pid;
  if (pid === undefined || exited()) return;

  if (platform === 'win32') {
    try {
      killWindowsTree(pid);
    } catch {
      child.kill();
    }
    return;
  }

  /** @type {NodeJS.Signals[]} */
  const steps = ['SIGINT', 'SIGTERM', 'SIGKILL'];
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  /** @param {number} step */
  const send = (step) => {
    if (exited()) return;
    const sig = /** @type {NodeJS.Signals} */ (steps[step]);
    try {
      killGroup(pid, sig);
    } catch {
      try {
        child.kill(sig);
      } catch {
        // Already gone.
      }
    }
    if (step + 1 < steps.length) {
      timer = setTimeout(() => send(step + 1), graceMs);
    }
  };
  child.once('exit', () => clearTimeout(timer));
  send(0);
}

/** @param {number} pid */
function taskkill(pid) {
  const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
    stdio: 'ignore',
    windowsHide: true,
  });
  killer.on('error', () => {});
}
