import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HostError } from './errors.mjs';
import {
  WINDOWS_MAX_COMMAND_LINE,
  quoteWindowsArg,
  runCli,
  stopAllNow,
  terminateTree,
  windowsCommandLineLength,
} from './process.mjs';

const node = process.execPath;
const env = { PATH: process.env.PATH ?? '', HOME: tmpdir() };

/** @param {string} source */
const script = (source) => ({
  command: node,
  args: ['-e', source],
  cwd: tmpdir(),
  env,
});

describe('runCli', () => {
  it('feeds stdin and collects stdout, stderr tail and exit code', async () => {
    const result = await runCli({
      ...script(
        `let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{process.stdout.write(s.toUpperCase());process.stderr.write('warn');process.exit(3)})`
      ),
      input: 'hello',
    });
    expect(result).toEqual({
      exitCode: 3,
      stdout: 'HELLO',
      stderrTail: 'warn',
    });
  });

  it('streams stdout to onStdout instead of buffering', async () => {
    const chunks = [];
    const result = await runCli({
      ...script(`process.stdout.write('a\\nb\\n')`),
      onStdout: (chunk) => chunks.push(chunk),
    });
    expect(result.stdout).toBe('');
    expect(Buffer.concat(chunks).toString()).toBe('a\nb\n');
  });

  it('runs in the given cwd with exactly the given env', async () => {
    const result = await runCli({
      ...script(
        `process.stdout.write(JSON.stringify({cwd:process.cwd(),keys:Object.keys(process.env)}))`
      ),
      env: { ONLY_THIS: '1', PATH: env.PATH },
    });
    const seen = JSON.parse(result.stdout);
    expect(seen.keys).toEqual(expect.arrayContaining(['ONLY_THIS', 'PATH']));
    expect(seen.keys).not.toContain('HOME');
  });

  it('rejects with cli_not_found when the executable is missing', async () => {
    await expect(
      runCli({ command: '/nonexistent/claude', args: [], cwd: tmpdir(), env })
    ).rejects.toMatchObject({ code: 'cli_not_found' });
  });

  it('stops the process on abort and rejects with the abort reason', async () => {
    const controller = new AbortController();
    const reason = new HostError('cancelled', 'cancelled by the extension');
    const pending = runCli({
      ...script(`setInterval(()=>{},1000);process.stdout.write('ready')`),
      signal: controller.signal,
      onStdout: () => controller.abort(reason),
      graceMs: 200,
    });
    await expect(pending).rejects.toBe(reason);
  });

  it('escalates to SIGKILL when the child ignores SIGINT and SIGTERM', async () => {
    if (process.platform === 'win32') return;
    const controller = new AbortController();
    const reason = new HostError('timeout', 'too slow');
    const started = Date.now();
    const pending = runCli({
      ...script(
        `process.on('SIGINT',()=>{});process.on('SIGTERM',()=>{});setInterval(()=>{},1000);process.stdout.write('ready')`
      ),
      signal: controller.signal,
      onStdout: () => controller.abort(reason),
      graceMs: 150,
    });
    await expect(pending).rejects.toBe(reason);
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const reason = new HostError('cancelled', 'early');
    await expect(
      runCli({ ...script('1'), signal: AbortSignal.abort(reason) })
    ).rejects.toBe(reason);
  });

  it('rejects a command line too long for Windows once quoting is counted', async () => {
    // 17,000 raw characters, but every quote gains a backslash when quoted.
    const schema = '"'.repeat(17_000);
    expect(windowsCommandLineLength(node, [schema])).toBeGreaterThan(
      WINDOWS_MAX_COMMAND_LINE
    );
    await expect(
      runCli({ ...script('1'), args: [schema], platform: 'win32' })
    ).rejects.toMatchObject({
      code: 'bad_request',
      message: expect.stringMatching(/after Windows quoting/),
    });
  });

  it('stops a process that writes more stdout than allowed', async () => {
    await expect(
      runCli({
        ...script(
          `process.stdout.write('x'.repeat(100000));setInterval(()=>{},1000)`
        ),
        maxStdoutBytes: 1000,
        graceMs: 100,
      })
    ).rejects.toMatchObject({ code: 'bad_output' });
  });
});

describe('quoteWindowsArg', () => {
  it('matches libuv quoting (quote_cmd_arg in src/win/process.c)', () => {
    // Expected values from the examples in libuv's source comments.
    expect(quoteWindowsArg('hello"world')).toBe('"hello\\"world"');
    expect(quoteWindowsArg('hello""world')).toBe('"hello\\"\\"world"');
    expect(quoteWindowsArg('hello\\world')).toBe('hello\\world');
    expect(quoteWindowsArg('hello\\\\world')).toBe('hello\\\\world');
    expect(quoteWindowsArg('hello\\"world')).toBe('"hello\\\\\\"world"');
    expect(quoteWindowsArg('hello\\\\"world')).toBe('"hello\\\\\\\\\\"world"');
    expect(quoteWindowsArg('hello world\\')).toBe('"hello world\\\\"');
    expect(quoteWindowsArg('')).toBe('""');
    expect(quoteWindowsArg('plain')).toBe('plain');
    expect(quoteWindowsArg('two words')).toBe('"two words"');
  });

  it('counts the quoted schema, not its raw length', () => {
    const arg = `--json-schema=${JSON.stringify({ type: 'object', required: ['a'] })}`;
    const quoteCount = arg.split('"').length - 1;
    expect(windowsCommandLineLength('C:\\claude.exe', [arg])).toBe(
      'C:\\claude.exe'.length + 1 + arg.length + 2 + quoteCount
    );
  });
});

describe('stopAllNow', () => {
  it('sends SIGTERM at once, skipping the SIGINT grace period', async () => {
    if (process.platform === 'win32') return;
    let ready;
    const started = new Promise((resolve) => (ready = resolve));
    const pending = runCli({
      ...script(
        `process.on('SIGINT',()=>{});setInterval(()=>{},1000);process.stdout.write('ready')`
      ),
      onStdout: () => ready(),
    });
    await started;
    const t0 = Date.now();
    await expect(stopAllNow({ graceMs: 5000 })).resolves.toBe(1);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect((await pending).exitCode).toBeNull();
  });

  it('escalates to SIGKILL and never restarts the SIGINT ladder on abort', async () => {
    if (process.platform === 'win32') return;
    const dir = await mkdtemp(join(tmpdir(), 'acorn-stop-test-'));
    const marker = join(dir, 'got-sigint');
    try {
      const controller = new AbortController();
      const reason = new HostError('cancelled', 'bridge is shutting down');
      let ready;
      const started = new Promise((resolve) => (ready = resolve));
      const pending = runCli({
        ...script(
          `process.on('SIGINT',()=>require('fs').writeFileSync(${JSON.stringify(marker)},'x'));process.on('SIGTERM',()=>{});setInterval(()=>{},1000);process.stdout.write('ready')`
        ),
        signal: controller.signal,
        onStdout: () => ready(),
      });
      await started;
      const t0 = Date.now();
      const stopped = stopAllNow({ graceMs: 200 });
      controller.abort(reason);
      await expect(pending).rejects.toBe(reason);
      await expect(stopped).resolves.toBe(1);
      expect(Date.now() - t0).toBeGreaterThanOrEqual(150);
      expect(existsSync(marker)).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('resolves at once when no CLI is running', async () => {
    await expect(stopAllNow()).resolves.toBe(0);
  });
});

describe('terminateTree', () => {
  afterEach(() => vi.useRealTimers());

  function fakeChild() {
    const child = new EventEmitter();
    child.pid = 4242;
    child.exitCode = null;
    child.signalCode = null;
    child.kill = vi.fn(() => true);
    return child;
  }

  it('signals the process group with SIGINT, SIGTERM, then SIGKILL', () => {
    vi.useFakeTimers();
    const child = fakeChild();
    const killGroup = vi.fn();
    terminateTree(child, { platform: 'linux', graceMs: 5000, killGroup });
    expect(killGroup.mock.calls).toEqual([[4242, 'SIGINT']]);
    vi.advanceTimersByTime(5000);
    expect(killGroup.mock.calls.at(-1)).toEqual([4242, 'SIGTERM']);
    vi.advanceTimersByTime(5000);
    expect(killGroup.mock.calls.at(-1)).toEqual([4242, 'SIGKILL']);
    vi.advanceTimersByTime(60_000);
    expect(killGroup).toHaveBeenCalledTimes(3);
  });

  it('can start the ladder at SIGTERM', () => {
    vi.useFakeTimers();
    const child = fakeChild();
    const killGroup = vi.fn();
    terminateTree(child, {
      platform: 'linux',
      graceMs: 500,
      signals: ['SIGTERM', 'SIGKILL'],
      killGroup,
    });
    expect(killGroup.mock.calls).toEqual([[4242, 'SIGTERM']]);
    vi.advanceTimersByTime(500);
    expect(killGroup.mock.calls).toEqual([
      [4242, 'SIGTERM'],
      [4242, 'SIGKILL'],
    ]);
  });

  it('stops escalating once the child exits', () => {
    vi.useFakeTimers();
    const child = fakeChild();
    const killGroup = vi.fn();
    terminateTree(child, { platform: 'darwin', graceMs: 5000, killGroup });
    child.exitCode = 0;
    child.emit('exit');
    vi.advanceTimersByTime(20_000);
    expect(killGroup).toHaveBeenCalledTimes(1);
  });

  it('falls back to child.kill when the group cannot be signalled', () => {
    const child = fakeChild();
    terminateTree(child, {
      platform: 'linux',
      killGroup: () => {
        throw new Error('ESRCH');
      },
    });
    expect(child.kill).toHaveBeenCalledWith('SIGINT');
  });

  it('uses taskkill for the whole tree on Windows', () => {
    const child = fakeChild();
    const killWindowsTree = vi.fn();
    const killGroup = vi.fn();
    terminateTree(child, { platform: 'win32', killWindowsTree, killGroup });
    expect(killWindowsTree).toHaveBeenCalledWith(4242);
    expect(killGroup).not.toHaveBeenCalled();
  });

  it('does nothing for a child that already exited', () => {
    const child = fakeChild();
    child.exitCode = 1;
    const killGroup = vi.fn();
    terminateTree(child, { platform: 'linux', killGroup });
    expect(killGroup).not.toHaveBeenCalled();
  });
});
