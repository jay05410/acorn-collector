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
/** Host shutdown (stopAllNow): SIGTERM at once, SIGKILL this long after. */
export const FAST_KILL_GRACE_MS = 500;
/** @type {NodeJS.Signals[]} */
const GRACEFUL_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGKILL'];
/** @type {NodeJS.Signals[]} */
const FAST_SIGNALS = ['SIGTERM', 'SIGKILL'];
/**
 * Longest command line CreateProcess accepts: 32,767 characters including
 * the terminating null.
 */
export const WINDOWS_MAX_COMMAND_LINE = 32_766;
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

/**
 * CLI processes started by runCli that have not exited yet, so a host that
 * is shutting down can stop all of them at once (stopAllNow).
 * @type {Set<import('node:child_process').ChildProcess>}
 */
const liveChildren = new Set();
/**
 * Children stopAllNow() is already stopping; a later abort or overflow must
 * not restart the slower SIGINT ladder on them.
 * @type {WeakSet<import('node:child_process').ChildProcess>}
 */
const stoppingNow = new WeakSet();

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
    if (platform === 'win32') {
      const length = windowsCommandLineLength(command, args);
      if (length > WINDOWS_MAX_COMMAND_LINE) {
        reject(
          new HostError(
            'bad_request',
            `the ${basename(command)} command line would be ${length} characters after Windows quoting, over the ${WINDOWS_MAX_COMMAND_LINE}-character limit; shorten the system prompt or schema`
          )
        );
        return;
      }
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

    if (child.pid !== undefined) {
      liveChildren.add(child);
      child.once('exit', () => liveChildren.delete(child));
    }

    const stop = () => {
      if (!stoppingNow.has(child)) terminateTree(child, { platform, graceMs });
    };
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
      liveChildren.delete(child);
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
 * Host shutdown: the browser may kill the host soon after the port closes,
 * and a CLI in its own process group would outlive it. Send SIGTERM to every
 * running CLI's process group now, without the SIGINT grace period, and
 * SIGKILL to groups still alive `graceMs` later (Windows: `taskkill /T /F`).
 * @param {Omit<TerminateOptions, 'signals'>} [options]
 * @returns {Promise<number>} Number of processes signalled; resolves once
 *   all of them have exited.
 */
export function stopAllNow(options = {}) {
  const { graceMs = FAST_KILL_GRACE_MS, ...rest } = options;
  const children = [...liveChildren];
  const exits = children.map((child) => {
    stoppingNow.add(child);
    const exited = new Promise((resolve) => child.once('exit', resolve));
    terminateTree(child, { ...rest, graceMs, signals: FAST_SIGNALS });
    return exited;
  });
  return Promise.all(exits).then(() => children.length);
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
 * @property {NodeJS.Signals[]} [signals] POSIX escalation, `graceMs` apart.
 * @property {(pid: number, signal: NodeJS.Signals) => void} [killGroup]
 * @property {(pid: number) => void} [killWindowsTree]
 */

/**
 * Stop a child and everything it spawned. POSIX: SIGINT, then SIGTERM and
 * SIGKILL `graceMs` apart (or the given `signals`), sent to the child's
 * process group. Windows: `taskkill /T /F` on the tree.
 * @param {KillableChild} child
 * @param {TerminateOptions} [options]
 */
export function terminateTree(child, options = {}) {
  const {
    platform = process.platform,
    graceMs = KILL_GRACE_MS,
    signals: steps = GRACEFUL_SIGNALS,
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

/**
 * Quote one argument exactly as libuv does when Node starts a process on
 * Windows (quote_cmd_arg in libuv src/win/process.c): arguments with spaces,
 * tabs or quotes are wrapped in quotes, embedded quotes are escaped and
 * backslashes before a quote (or the closing quote) are doubled.
 * @param {string} arg
 * @returns {string}
 */
export function quoteWindowsArg(arg) {
  if (arg === '') return '""';
  if (!/[ \t"]/.test(arg)) return arg;
  if (!/["\\]/.test(arg)) return `"${arg}"`;
  /** @type {string[]} */
  const reversed = [];
  let quoteHit = true;
  for (let i = arg.length - 1; i >= 0; i -= 1) {
    const ch = /** @type {string} */ (arg[i]);
    reversed.push(ch);
    if (quoteHit && ch === '\\') {
      reversed.push('\\');
    } else if (ch === '"') {
      quoteHit = true;
      reversed.push('\\');
    } else {
      quoteHit = false;
    }
  }
  return `"${reversed.reverse().join('')}"`;
}

/**
 * Length of the command line Node builds on Windows (UTF-16 code units).
 * @param {string} command
 * @param {string[]} args
 */
export function windowsCommandLineLength(command, args) {
  return [command, ...args].map(quoteWindowsArg).join(' ').length;
}

/** @param {number} pid */
function taskkill(pid) {
  const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
    stdio: 'ignore',
    windowsHide: true,
  });
  killer.on('error', () => {});
}
