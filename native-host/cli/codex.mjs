// @ts-check
/**
 * OpenAI Codex (`codex exec`) adapter. The prompt goes on stdin: `--image` is
 * variadic and would swallow a positional prompt. The schema and images are
 * files in the job's private temp dir, and the final message is read from the
 * `-o` file.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HostError, truncate } from '../lib/errors.mjs';
import { isRecord } from '../lib/validate.mjs';

const SCHEMA_FILE = 'schema.json';
const OUTPUT_FILE = 'last-message.json';

const AUTH_FAILURE = /not logged in|codex login|\b401\b|unauthori[sz]ed/i;
const RATE_LIMITED = /\b429\b|rate limit|usage limit/i;

/**
 * @typedef {import('./claude.mjs').CliJobContext} CliJobContext
 * @typedef {import('./claude.mjs').CliOutput} CliOutput
 */

/**
 * @param {object} options
 * @param {string} options.model Empty string keeps the CLI default.
 * @param {string} options.workDir
 * @param {string} options.schemaFile
 * @param {string} options.outputFile
 * @param {string[]} options.imageFiles Names relative to workDir (no commas).
 * @returns {string[]}
 */
export function buildCodexArgs({
  model,
  workDir,
  schemaFile,
  outputFile,
  imageFiles,
}) {
  const args = [
    'exec',
    '--ephemeral',
    '--skip-git-repo-check',
    '--sandbox',
    'read-only',
    '--color',
    'never',
    '--output-schema',
    schemaFile,
    '-o',
    outputFile,
    '-C',
    workDir,
  ];
  if (model) args.push('-m', model);
  if (imageFiles.length > 0) args.push('--image', imageFiles.join(','));
  return args;
}

/**
 * Codex has no separate system prompt flag, so instructions lead the prompt.
 * @param {{ system: string, text: string }} request
 */
export function buildCodexPrompt({ system, text }) {
  return [system.trim(), text.trim()].filter(Boolean).join('\n\n');
}

/**
 * Parse the final message written by `-o`. With --output-schema it is a JSON
 * object; a Markdown code fence around it is tolerated.
 * @param {string} content
 * @returns {Record<string, unknown>}
 */
export function parseCodexOutput(content) {
  const trimmed = content.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```$/.exec(trimmed);
  const body = fenced?.[1] ?? trimmed;
  if (!body)
    throw new HostError('bad_output', 'codex wrote an empty final message');
  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new HostError('bad_output', 'codex final message is not JSON');
  }
  if (!isRecord(parsed)) {
    throw new HostError(
      'bad_output',
      'codex final message is not a JSON object'
    );
  }
  return parsed;
}

/**
 * @param {number | null} exitCode
 * @param {string} stderrTail
 * @returns {HostError}
 */
export function classifyCodexFailure(exitCode, stderrTail) {
  const detail = stderrTail.trim();
  if (AUTH_FAILURE.test(detail)) {
    return new HostError(
      'not_logged_in',
      'Codex is not logged in; run `codex login`'
    );
  }
  if (RATE_LIMITED.test(detail)) {
    return new HostError('rate_limited', truncate(detail, 500));
  }
  return new HostError(
    'cli_failed',
    truncate(
      `codex exited with code ${exitCode}${detail ? `: ${detail}` : ''}`,
      1000
    )
  );
}

/**
 * `codex login status` exits 0 when logged in. Its text output is not
 * forwarded.
 * @param {number | null} exitCode
 */
export function parseCodexLoginStatus(exitCode) {
  return { loggedIn: exitCode === 0, authMethod: null, subscriptionType: null };
}

export const CODEX_STATUS_ARGS = ['login', 'status'];

/**
 * @param {CliJobContext} context
 * @returns {Promise<CliOutput>}
 */
export async function runCodex({ cliPath, request, jobDir, env, signal, run }) {
  const schemaFile = join(jobDir, SCHEMA_FILE);
  const outputFile = join(jobDir, OUTPUT_FILE);
  await writeFile(schemaFile, JSON.stringify(request.schema), { mode: 0o600 });
  /** @type {string[]} */
  const imageFiles = [];
  // One image is decoded at a time, so at most one decoded copy is alive.
  for (const [index, image] of request.images.entries()) {
    const name = `image-${index + 1}.${image.extension}`;
    await writeFile(join(jobDir, name), Buffer.from(image.base64, 'base64'), {
      mode: 0o600,
    });
    imageFiles.push(name);
  }

  const outcome = await run({
    command: cliPath,
    args: buildCodexArgs({
      model: request.model,
      workDir: jobDir,
      schemaFile,
      outputFile,
      imageFiles,
    }),
    cwd: jobDir,
    env,
    input: buildCodexPrompt(request),
    signal,
    // The answer is read from the -o file; progress output is not needed.
    onStdout: () => {},
  });
  if (outcome.exitCode !== 0) {
    throw classifyCodexFailure(outcome.exitCode, outcome.stderrTail);
  }

  let content;
  try {
    content = await readFile(outputFile, 'utf8');
  } catch {
    throw new HostError(
      'bad_output',
      'codex exited without writing a final message'
    );
  }
  return {
    output: parseCodexOutput(content),
    model: request.model || null,
    usage: null,
  };
}
