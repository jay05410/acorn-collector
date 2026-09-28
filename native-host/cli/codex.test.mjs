import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildCodexArgs,
  buildCodexPrompt,
  classifyCodexFailure,
  parseCodexLoginStatus,
  parseCodexOutput,
  runCodex,
} from './codex.mjs';

describe('buildCodexArgs', () => {
  const base = {
    model: '',
    workDir: '/tmp/job',
    schemaFile: '/tmp/job/schema.json',
    outputFile: '/tmp/job/last-message.json',
    imageFiles: ['image-1.jpg', 'image-2.png'],
  };

  it('uses the read-only, ephemeral exec route with schema and output files', () => {
    expect(buildCodexArgs(base)).toEqual([
      'exec',
      '--ephemeral',
      '--skip-git-repo-check',
      '--sandbox',
      'read-only',
      '--color',
      'never',
      '--output-schema',
      '/tmp/job/schema.json',
      '-o',
      '/tmp/job/last-message.json',
      '-C',
      '/tmp/job',
      '--image',
      'image-1.jpg,image-2.png',
    ]);
  });

  it('puts nothing after the variadic --image list (no positional prompt)', () => {
    const args = buildCodexArgs({ ...base, model: 'gpt-6-luna' });
    expect(args.at(-2)).toBe('--image');
    expect(args.at(-1)).toBe('image-1.jpg,image-2.png');
    expect(args).toContain('-m');
    expect(args[args.indexOf('-m') + 1]).toBe('gpt-6-luna');
  });

  it('omits -m for the CLI default model and --image without images', () => {
    const args = buildCodexArgs({ ...base, imageFiles: [] });
    expect(args).not.toContain('-m');
    expect(args).not.toContain('--image');
    expect(args.at(-1)).toBe('/tmp/job');
  });
});

describe('buildCodexPrompt', () => {
  it('leads with the instructions', () => {
    expect(buildCodexPrompt({ system: ' Rules. ', text: 'Post text' })).toBe(
      'Rules.\n\nPost text'
    );
    expect(buildCodexPrompt({ system: '', text: 'Only text' })).toBe(
      'Only text'
    );
  });
});

describe('parseCodexOutput', () => {
  it('parses a JSON object, with or without a code fence', () => {
    expect(parseCodexOutput('{"items":[]}\n')).toEqual({ items: [] });
    expect(parseCodexOutput('```json\n{"items":[1]}\n```')).toEqual({
      items: [1],
    });
  });

  it('rejects empty, non-JSON and non-object output', () => {
    for (const content of ['', '   ', 'Here you go', '[1,2]', '"text"']) {
      expect(() => parseCodexOutput(content)).toThrow(
        expect.objectContaining({ code: 'bad_output' })
      );
    }
  });
});

describe('classifyCodexFailure', () => {
  it('recognizes login and rate-limit failures', () => {
    expect(
      classifyCodexFailure(1, 'Error: Not logged in. Run `codex login`').code
    ).toBe('not_logged_in');
    expect(
      classifyCodexFailure(1, 'unexpected status 401 Unauthorized').code
    ).toBe('not_logged_in');
    expect(
      classifyCodexFailure(1, 'stream error: 429 Too Many Requests').code
    ).toBe('rate_limited');
  });

  it('falls back to a CLI failure with the stderr tail', () => {
    const error = classifyCodexFailure(127, 'spawn ENOENT');
    expect(error.code).toBe('cli_failed');
    expect(error.message).toMatch(/code 127: spawn ENOENT/);
  });
});

describe('parseCodexLoginStatus', () => {
  it('uses the exit code only', () => {
    expect(parseCodexLoginStatus(0).loggedIn).toBe(true);
    expect(parseCodexLoginStatus(1).loggedIn).toBe(false);
  });
});

describe('runCodex', () => {
  let jobDir;
  beforeEach(async () => {
    jobDir = await mkdtemp(join(tmpdir(), 'acorn-codex-test-'));
  });
  afterEach(async () => {
    await rm(jobDir, { recursive: true, force: true });
  });

  const request = {
    model: '',
    system: 'Rules.',
    text: 'Post',
    images: [
      {
        mimeType: 'image/png',
        extension: 'png',
        base64: Buffer.from([1, 2]).toString('base64'),
      },
    ],
    schema: { type: 'object' },
  };

  it('writes schema and images privately, sends the prompt on stdin, reads -o', async () => {
    const run = vi.fn(async (options) => {
      const outputFile = options.args[options.args.indexOf('-o') + 1];
      await writeFile(outputFile, '{"items":[{"name":"x"}]}');
      return { exitCode: 0, stdout: '', stderrTail: '' };
    });
    const result = await runCodex({
      cliPath: '/opt/homebrew/bin/codex',
      request,
      jobDir,
      env: { HOME: '/Users/me' },
      signal: new AbortController().signal,
      run,
    });
    expect(result).toEqual({
      output: { items: [{ name: 'x' }] },
      model: null,
      usage: null,
    });

    const options = run.mock.calls[0][0];
    expect(options.input).toBe('Rules.\n\nPost');
    expect(options.cwd).toBe(jobDir);
    expect(options.args).toContain('image-1.png');
    const schema = await readFile(join(jobDir, 'schema.json'), 'utf8');
    expect(JSON.parse(schema)).toEqual({ type: 'object' });
    expect(await readFile(join(jobDir, 'image-1.png'))).toEqual(
      Buffer.from([1, 2])
    );
    if (process.platform !== 'win32') {
      expect((await stat(join(jobDir, 'image-1.png'))).mode & 0o777).toBe(
        0o600
      );
    }
  });

  it('classifies a non-zero exit', async () => {
    const run = async () => ({
      exitCode: 1,
      stdout: '',
      stderrTail: 'Not logged in',
    });
    await expect(
      runCodex({
        cliPath: 'codex',
        request,
        jobDir,
        env: {},
        signal: new AbortController().signal,
        run,
      })
    ).rejects.toMatchObject({ code: 'not_logged_in' });
  });

  it('fails when codex exits cleanly without an output file', async () => {
    const run = async () => ({ exitCode: 0, stdout: '', stderrTail: '' });
    await expect(
      runCodex({
        cliPath: 'codex',
        request,
        jobDir,
        env: {},
        signal: new AbortController().signal,
        run,
      })
    ).rejects.toMatchObject({ code: 'bad_output' });
    expect((await readdir(jobDir)).sort()).toEqual([
      'image-1.png',
      'schema.json',
    ]);
  });
});
