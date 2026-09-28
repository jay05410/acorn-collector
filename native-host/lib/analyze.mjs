// @ts-check
/**
 * Runs one validated 'analyze' request on the chosen CLI inside a private
 * temp dir that is always removed afterwards.
 */
import { dirname } from 'node:path';
import { runClaude } from '../cli/claude.mjs';
import { runCodex } from '../cli/codex.mjs';
import { buildChildEnv } from './env.mjs';
import { HostError } from './errors.mjs';
import { createJobDir, removeJobDir } from './tempdir.mjs';

/**
 * @typedef {import('./validate.mjs').AnalyzeRequest} AnalyzeRequest
 * @typedef {import('./config.mjs').CliPaths} CliPaths
 * @typedef {import('./process.mjs').RunCli} RunCli
 * @typedef {import('../cli/claude.mjs').CliOutput} CliOutput
 */

/**
 * @typedef {object} AnalyzeDeps
 * @property {CliPaths} cliPaths
 * @property {Record<string, string | undefined>} env Host environment; the
 *   child gets an allowlisted copy.
 * @property {NodeJS.Platform} platform
 * @property {RunCli} run
 * @property {string} [tmpRoot]
 * @property {(line: string) => void} [debug]
 */

/**
 * @param {AnalyzeRequest} request
 * @param {AbortSignal} signal
 * @param {AnalyzeDeps} deps
 * @returns {Promise<CliOutput>}
 */
export async function runAnalyzeJob(request, signal, deps) {
  const cliPath = deps.cliPaths[request.target];
  if (!cliPath) {
    throw new HostError(
      'cli_not_found',
      `${request.target} was not found when the bridge was installed; install it, then re-run install.mjs`
    );
  }
  const env = buildChildEnv(deps.env, {
    platform: deps.platform,
    pathDirs: [dirname(process.execPath), dirname(cliPath)],
  });
  const jobDir = await createJobDir(deps.tmpRoot);
  try {
    const context = {
      cliPath,
      request,
      jobDir,
      env,
      signal,
      run: deps.run,
      debug: deps.debug,
    };
    return request.target === 'claude'
      ? await runClaude(context)
      : await runCodex(context);
  } finally {
    await removeJobDir(jobDir);
  }
}
