import { EventEmitter } from 'node:events';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HostError } from './errors.mjs';
import { runCli, terminateTree } from './process.mjs';

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
