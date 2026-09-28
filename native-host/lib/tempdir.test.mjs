import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  JOB_DIR_PREFIX,
  STALE_JOB_DIR_MS,
  createJobDir,
  removeJobDir,
  removeJobDirsSync,
  sweepStaleJobDirs,
} from './tempdir.mjs';

let root;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'acorn-tempdir-test-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('createJobDir / removeJobDir', () => {
  it('creates a private prefixed directory and removes it with its contents', async () => {
    const dir = await createJobDir(root);
    expect(dir.startsWith(join(root, JOB_DIR_PREFIX))).toBe(true);
    if (process.platform !== 'win32') {
      expect((await stat(dir)).mode & 0o777).toBe(0o700);
    }
    await writeFile(join(dir, 'image-1.jpg'), 'x');
    await removeJobDir(dir);
    expect(await readdir(root)).toEqual([]);
  });

  it('removes the dirs of unfinished jobs synchronously on shutdown', async () => {
    const done = await createJobDir(root);
    await removeJobDir(done);
    const first = await createJobDir(root);
    const second = await createJobDir(root);
    await writeFile(join(first, 'image-1.jpg'), 'x');

    expect(removeJobDirsSync()).toBe(2);
    // Already gone when the call returns, with no await in between.
    expect(existsSync(first)).toBe(false);
    expect(existsSync(second)).toBe(false);
    expect(removeJobDirsSync()).toBe(0);
  });
});

describe('sweepStaleJobDirs', () => {
  it('removes only job dirs older than the limit', async () => {
    const now = Date.now();
    const old = join(root, `${JOB_DIR_PREFIX}old`);
    const fresh = join(root, `${JOB_DIR_PREFIX}fresh`);
    const unrelated = join(root, 'acorn-other');
    for (const dir of [old, fresh, unrelated]) await mkdir(dir);
    await writeFile(join(old, 'schema.json'), '{}');
    const past = new Date(now - STALE_JOB_DIR_MS - 60_000);
    await utimes(old, past, past);
    await utimes(unrelated, past, past);

    expect(await sweepStaleJobDirs({ root, now })).toBe(1);
    expect((await readdir(root)).sort()).toEqual([
      `${JOB_DIR_PREFIX}fresh`,
      'acorn-other',
    ]);
  });

  it('returns 0 when the temp root cannot be read', async () => {
    expect(await sweepStaleJobDirs({ root: join(root, 'missing') })).toBe(0);
  });
});
