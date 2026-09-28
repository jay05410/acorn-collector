import { access, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runAnalyzeJob } from './analyze.mjs';

const RESULT_LINE = JSON.stringify({
  type: 'result',
  subtype: 'success',
  is_error: false,
  structured_output: { items: [] },
});

const request = {
  id: 'r1',
  op: 'analyze',
  target: 'claude',
  model: 'sonnet',
  system: 'S',
  text: 'T',
  images: [],
  schema: { type: 'object' },
};

let tmpRoot;
beforeEach(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), 'acorn-analyze-test-'));
});
afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

const deps = (
  run,
  cliPaths = { claude: '/Users/me/.local/bin/claude', codex: null }
) => ({
  cliPaths,
  env: {
    HOME: '/Users/me',
    PATH: '/usr/bin',
    ANTHROPIC_API_KEY: 'sk-ant-x',
    CLAUDECODE: '1',
  },
  platform: 'darwin',
  run,
  tmpRoot,
});

describe('runAnalyzeJob', () => {
  it('runs claude in a fresh job dir with a scrubbed env, then removes the dir', async () => {
    let jobDir;
    const run = vi.fn(async (options) => {
      jobDir = options.cwd;
      await access(jobDir);
      options.onStdout(Buffer.from(`${RESULT_LINE}\n`));
      return { exitCode: 0, stdout: '', stderrTail: '' };
    });
    const result = await runAnalyzeJob(
      request,
      new AbortController().signal,
      deps(run)
    );

    expect(result.output).toEqual({ items: [] });
    const { env, command } = run.mock.calls[0][0];
    expect(command).toBe('/Users/me/.local/bin/claude');
    expect(env).not.toHaveProperty('ANTHROPIC_API_KEY');
    expect(env).not.toHaveProperty('CLAUDECODE');
    expect(env.PATH.split(':')).toContain('/Users/me/.local/bin');
    expect(jobDir.startsWith(tmpRoot)).toBe(true);
    expect(await readdir(tmpRoot)).toEqual([]);
  });

  it('removes the job dir when the CLI fails', async () => {
    const run = vi.fn(async () => ({
      exitCode: 1,
      stdout: '',
      stderrTail: 'boom',
    }));
    await expect(
      runAnalyzeJob(request, new AbortController().signal, deps(run))
    ).rejects.toMatchObject({ code: 'cli_failed' });
    expect(await readdir(tmpRoot)).toEqual([]);
  });

  it('reports a CLI that was not found at install time', async () => {
    const run = vi.fn();
    await expect(
      runAnalyzeJob(
        { ...request, target: 'codex' },
        new AbortController().signal,
        deps(run)
      )
    ).rejects.toMatchObject({ code: 'cli_not_found' });
    expect(run).not.toHaveBeenCalled();
  });
});
