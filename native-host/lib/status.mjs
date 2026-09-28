// @ts-check
/**
 * The 'status' op: is each CLI configured, runnable and logged in? Only
 * non-identifying fields are reported (no email, organization or paths).
 */
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname } from 'node:path';
import { CLAUDE_STATUS_ARGS, parseClaudeAuthStatus } from '../cli/claude.mjs';
import { CODEX_STATUS_ARGS, parseCodexLoginStatus } from '../cli/codex.mjs';
import { PROTOCOL_VERSION } from '../protocol.mjs';
import { buildChildEnv } from './env.mjs';

export const STATUS_TIMEOUT_MS = 15_000;

/**
 * @typedef {import('./config.mjs').CliPaths} CliPaths
 * @typedef {import('./process.mjs').RunCli} RunCli
 * @typedef {import('./validate.mjs').CliTarget} CliTarget
 */

/**
 * @typedef {object} TargetStatus
 * @property {boolean} installed
 * @property {boolean} loggedIn
 * @property {string | null} authMethod
 * @property {string | null} subscriptionType
 * @property {string[]} warnings
 */

/**
 * @typedef {object} BridgeStatus
 * @property {number} protocol
 * @property {NodeJS.Platform} platform
 * @property {Record<CliTarget, TargetStatus>} targets
 */

/**
 * @typedef {object} StatusDeps
 * @property {CliPaths} cliPaths
 * @property {Record<string, string | undefined>} env Host environment.
 * @property {NodeJS.Platform} platform
 * @property {RunCli} run
 * @property {(path: string) => Promise<boolean>} [isExecutable]
 */

/**
 * @param {StatusDeps} deps
 * @returns {Promise<BridgeStatus>}
 */
export async function collectStatus(deps) {
  const [claude, codex] = await Promise.all([
    targetStatus('claude', deps),
    targetStatus('codex', deps),
  ]);
  return { protocol: PROTOCOL_VERSION, platform: deps.platform, targets: { claude, codex } };
}

/**
 * Warnings about the host's own environment. An ANTHROPIC_API_KEY would make
 * Claude Code bill the API instead of the subscription; the bridge strips it.
 * @param {CliTarget} target
 * @param {Record<string, string | undefined>} env
 * @returns {string[]}
 */
export function environmentWarnings(target, env) {
  return target === 'claude' && env.ANTHROPIC_API_KEY ? ['anthropic_api_key_ignored'] : [];
}

/**
 * @param {CliTarget} target
 * @param {StatusDeps} deps
 * @returns {Promise<TargetStatus>}
 */
async function targetStatus(target, deps) {
  const { cliPaths, env, platform, run, isExecutable = canExecute } = deps;
  const warnings = environmentWarnings(target, env);
  const cliPath = cliPaths[target];
  const missing = { installed: false, loggedIn: false, authMethod: null, subscriptionType: null, warnings };
  if (!cliPath || !(await isExecutable(cliPath))) return missing;

  try {
    const outcome = await run({
      command: cliPath,
      args: target === 'claude' ? CLAUDE_STATUS_ARGS : CODEX_STATUS_ARGS,
      cwd: tmpdir(),
      env: buildChildEnv(env, {
        platform,
        pathDirs: [dirname(process.execPath), dirname(cliPath)],
      }),
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
    });
    const auth =
      target === 'claude'
        ? parseClaudeAuthStatus(outcome.stdout, outcome.exitCode)
        : parseCodexLoginStatus(outcome.exitCode);
    return { installed: true, ...auth, warnings };
  } catch {
    return { ...missing, installed: true, warnings: [...warnings, 'status_check_failed'] };
  }
}

/** @param {string} path */
async function canExecute(path) {
  try {
    await access(path, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
