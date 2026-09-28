// @ts-check
/**
 * Host configuration written by install.mjs next to host.mjs:
 * { "version": 1, "allowedOrigins": [...], "cliPaths": { "claude": ..., "codex": ... } }
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isRecord } from './validate.mjs';

export const CONFIG_FILE_NAME = 'config.json';
export const CONFIG_VERSION = 1;
/** Overrides the config location (used by scripts/e2e.mjs). */
export const CONFIG_ENV_VAR = 'ACORN_BRIDGE_CONFIG';

/** Chrome and Edge extension origins: 32 letters a-p plus a trailing slash. */
export const ORIGIN_PATTERN = /^chrome-extension:\/\/[a-p]{32}\/$/;

/**
 * @typedef {object} CliPaths
 * @property {string | null} claude
 * @property {string | null} codex
 */

/**
 * @typedef {object} HostConfig
 * @property {string[]} allowedOrigins
 * @property {CliPaths} cliPaths
 */

/**
 * @param {Record<string, string | undefined>} env
 * @param {string} hostDir
 */
export function configPath(env, hostDir) {
  return env[CONFIG_ENV_VAR] || join(hostDir, CONFIG_FILE_NAME);
}

/**
 * @param {unknown} raw
 * @returns {HostConfig}
 */
export function parseConfig(raw) {
  if (!isRecord(raw) || raw.version !== CONFIG_VERSION) {
    throw new Error(`config.json must be an object with "version": ${CONFIG_VERSION}`);
  }
  const { allowedOrigins, cliPaths } = raw;
  if (
    !Array.isArray(allowedOrigins) ||
    !allowedOrigins.every((origin) => typeof origin === 'string' && ORIGIN_PATTERN.test(origin))
  ) {
    throw new Error('config.json allowedOrigins must be chrome-extension://<id>/ origins');
  }
  if (!isRecord(cliPaths)) throw new Error('config.json cliPaths must be an object');
  return {
    allowedOrigins,
    cliPaths: { claude: pathOrNull(cliPaths.claude), codex: pathOrNull(cliPaths.codex) },
  };
}

/**
 * @param {string} path
 * @returns {Promise<HostConfig>}
 */
export async function loadConfig(path) {
  return parseConfig(JSON.parse(await readFile(path, 'utf8')));
}

/**
 * @param {string} origin argv[1] as passed by the browser.
 * @param {HostConfig} config
 */
export function isAllowedOrigin(origin, config) {
  return ORIGIN_PATTERN.test(origin) && config.allowedOrigins.includes(origin);
}

/** @param {unknown} value */
function pathOrNull(value) {
  return typeof value === 'string' && value !== '' ? value : null;
}
