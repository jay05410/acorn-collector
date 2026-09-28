// @ts-check
/**
 * One private temp directory per job (images, schema and output files for
 * the CLI), removed when the job ends, or synchronously when the host shuts
 * down. A sweep at startup removes leftovers from a host that was killed
 * mid-job.
 */
import { rmSync } from 'node:fs';
import { chmod, lstat, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const JOB_DIR_PREFIX = 'acorn-bridge-';
export const STALE_JOB_DIR_MS = 60 * 60 * 1000;

/**
 * Job directories created and not yet removed by this process.
 * @type {Set<string>}
 */
const liveJobDirs = new Set();

/**
 * @param {string} [root]
 * @returns {Promise<string>} Absolute path of a new 0700 directory.
 */
export async function createJobDir(root = tmpdir()) {
  const dir = await mkdtemp(join(root, JOB_DIR_PREFIX));
  liveJobDirs.add(dir);
  await chmod(dir, 0o700);
  return dir;
}

/** @param {string} dir */
export async function removeJobDir(dir) {
  await rm(dir, { recursive: true, force: true });
  liveJobDirs.delete(dir);
}

/**
 * Remove every job directory this process still has, synchronously, so it
 * completes even if the host is killed right after (host shutdown).
 * @returns {number} Number of directories removed.
 */
export function removeJobDirsSync() {
  let removed = 0;
  for (const dir of liveJobDirs) {
    try {
      rmSync(dir, { recursive: true, force: true });
      removed += 1;
    } catch {
      // Left for the startup sweep.
    }
    liveJobDirs.delete(dir);
  }
  return removed;
}

/**
 * Remove job directories older than `maxAgeMs` that belong to this user.
 * @param {object} [options]
 * @param {string} [options.root]
 * @param {number} [options.now]
 * @param {number} [options.maxAgeMs]
 * @returns {Promise<number>} Number of directories removed.
 */
export async function sweepStaleJobDirs(options = {}) {
  const {
    root = tmpdir(),
    now = Date.now(),
    maxAgeMs = STALE_JOB_DIR_MS,
  } = options;
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return 0;
  }
  const uid = typeof process.getuid === 'function' ? process.getuid() : null;
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(JOB_DIR_PREFIX)) {
      continue;
    }
    const dir = join(root, entry.name);
    try {
      const stats = await lstat(dir);
      if (uid !== null && stats.uid !== uid) continue;
      if (now - stats.mtimeMs < maxAgeMs) continue;
      await rm(dir, { recursive: true, force: true });
      removed += 1;
    } catch {
      // Removed concurrently by another host instance.
    }
  }
  return removed;
}
