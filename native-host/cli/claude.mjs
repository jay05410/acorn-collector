// @ts-check
/**
 * Claude Code (`claude`) adapter. One print-mode run per job with
 * stream-json input (so images can be sent inline) and stream-json output;
 * the answer is the `structured_output` of the last `result` line.
 *
 * Never pass --bare: it skips the subscription login. The child env comes
 * from lib/env.mjs, which drops ANTHROPIC_API_KEY so the user's subscription
 * is billed rather than the API.
 */
import { StringDecoder } from 'node:string_decoder';
import { HostError, truncate } from '../lib/errors.mjs';
import { isRecord } from '../lib/validate.mjs';

/** Structured output needs a tool round-trip, so allow a few turns. */
export const CLAUDE_MAX_TURNS = 3;

const AUTH_FAILURE = /\b401\b|authentication_error|invalid api key|please run \/login|not logged in|oauth token/i;
const RATE_LIMITED = /\b429\b|rate_limit|rate limit|usage limit|hit your limit/i;

/**
 * @typedef {import('../lib/validate.mjs').AnalyzeRequest} AnalyzeRequest
 * @typedef {import('../lib/process.mjs').RunCli} RunCli
 */

/**
 * @typedef {object} Usage
 * @property {number} [inputTokens]
 * @property {number} [outputTokens]
 */

/**
 * @typedef {object} CliOutput
 * @property {Record<string, unknown>} output Parsed structured output.
 * @property {string | null} model Model reported by the CLI, if any.
 * @property {Usage | null} usage
 */

/**
 * Command-line arguments. Values use the `--flag=value` form so a prompt that
 * starts with "-" can never be read as another flag.
 * @param {Pick<AnalyzeRequest, 'model' | 'system' | 'schema'>} request
 * @param {{ restrictTools?: boolean }} [options] Offer the model only the
 *   StructuredOutput tool (no Bash, file or web tools).
 * @returns {string[]}
 */
export function buildClaudeArgs({ model, system, schema }, { restrictTools = true } = {}) {
  const args = [
    '-p',
    '--input-format',
    'stream-json',
    '--output-format',
    'stream-json',
    '--verbose',
    '--safe-mode',
    '--no-session-persistence',
    '--permission-mode',
    'dontAsk',
    '--max-turns',
    String(CLAUDE_MAX_TURNS),
    ...(restrictTools ? ['--tools', 'StructuredOutput'] : []),
    `--json-schema=${JSON.stringify(schema)}`,
  ];
  if (model) args.push(`--model=${model}`);
  if (system) args.push(`--system-prompt=${system}`);
  return args;
}

/**
 * The single stream-json user message written to stdin. Images go first, as
 * Anthropic recommends for image-plus-text prompts.
 * @param {Pick<AnalyzeRequest, 'text' | 'images'>} request
 * @returns {string} One JSONL line including the trailing newline.
 */
export function buildClaudeInput({ text, images }) {
  const content = [
    ...images.map((image) => ({
      type: 'image',
      source: { type: 'base64', media_type: image.mimeType, data: image.base64 },
    })),
    ...(text ? [{ type: 'text', text }] : []),
  ];
  const message = {
    type: 'user',
    message: { role: 'user', content },
    parent_tool_use_id: null,
  };
  return `${JSON.stringify(message)}\n`;
}

/**
 * Incremental reader for stream-json stdout. Keeps only what the host needs
 * (the init model and the last result line) instead of buffering everything.
 */
export class ClaudeStreamParser {
  #decoder = new StringDecoder('utf8');
  #partial = '';
  /** @type {string | null} */
  model = null;
  /** @type {Record<string, unknown> | null} */
  result = null;
  #onLine;

  /** @param {(line: string) => void} [onLine] Debug tap for raw lines. */
  constructor(onLine) {
    this.#onLine = onLine;
  }

  /** @param {Buffer} chunk */
  push(chunk) {
    const lines = (this.#partial + this.#decoder.write(chunk)).split('\n');
    this.#partial = lines.pop() ?? '';
    for (const line of lines) this.#line(line);
  }

  end() {
    const rest = this.#partial + this.#decoder.end();
    this.#partial = '';
    this.#line(rest);
  }

  /** @param {string} line */
  #line(line) {
    const trimmed = line.trim();
    if (!trimmed) return;
    this.#onLine?.(trimmed);
    /** @type {unknown} */
    let message;
    try {
      message = JSON.parse(trimmed);
    } catch {
      return;
    }
    if (!isRecord(message)) return;
    if (message.type === 'result') {
      this.result = message;
    } else if (
      message.type === 'system' &&
      message.subtype === 'init' &&
      typeof message.model === 'string'
    ) {
      this.model = message.model;
    }
  }
}

/**
 * Turn the final `result` line (or its absence) into output or a HostError.
 * @param {Record<string, unknown> | null} result
 * @param {{ exitCode: number | null, stderrTail: string }} run
 * @returns {{ output: Record<string, unknown>, usage: Usage | null }}
 */
export function interpretClaudeResult(result, { exitCode, stderrTail }) {
  if (!result) {
    const detail = stderrTail.trim();
    if (AUTH_FAILURE.test(detail)) {
      throw new HostError('not_logged_in', 'Claude Code is not logged in; run `claude` and log in');
    }
    throw new HostError(
      'cli_failed',
      truncate(`claude exited with code ${exitCode} without a result${detail ? `: ${detail}` : ''}`, 1000)
    );
  }

  const subtype = result.subtype;
  const isError = result.is_error === true;
  if (subtype === 'success' && !isError) {
    if (isRecord(result.structured_output)) {
      return { output: result.structured_output, usage: readUsage(result.usage) };
    }
    throw new HostError('bad_output', 'claude finished without structured_output');
  }
  if (subtype === 'error_max_structured_output_retries') {
    throw new HostError('bad_output', 'claude could not produce output matching the schema');
  }
  if (subtype === 'error_max_turns') {
    throw new HostError('bad_output', `claude hit the ${CLAUDE_MAX_TURNS}-turn limit`);
  }

  const detail = typeof result.result === 'string' ? result.result : '';
  const apiStatus = typeof result.api_error_status === 'number' ? result.api_error_status : null;
  if (apiStatus === 401 || AUTH_FAILURE.test(detail)) {
    throw new HostError('not_logged_in', 'Claude Code login is missing or expired; run `claude` and log in');
  }
  if (apiStatus === 429 || RATE_LIMITED.test(detail)) {
    throw new HostError('rate_limited', truncate(detail || 'Claude usage limit reached', 500));
  }
  throw new HostError(
    'cli_failed',
    truncate(`claude reported ${String(subtype)}${detail ? `: ${detail}` : ''}`, 1000)
  );
}

/**
 * Token counts from a result line. Cached prompt tokens count as input.
 * @param {unknown} usage
 * @returns {Usage | null}
 */
function readUsage(usage) {
  if (!isRecord(usage)) return null;
  /** @param {unknown} value */
  const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
  const input =
    num(usage.input_tokens) +
    num(usage.cache_creation_input_tokens) +
    num(usage.cache_read_input_tokens);
  /** @type {Usage} */
  const out = {};
  if (input > 0) out.inputTokens = input;
  if (typeof usage.output_tokens === 'number') out.outputTokens = usage.output_tokens;
  return out;
}

/**
 * `claude auth status` prints JSON and exits 0 when logged in. Only the
 * non-identifying fields are kept (never email or organization).
 * @param {string} stdout
 * @param {number | null} exitCode
 * @returns {{ loggedIn: boolean, authMethod: string | null, subscriptionType: string | null }}
 */
export function parseClaudeAuthStatus(stdout, exitCode) {
  /** @type {unknown} */
  let parsed = null;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    parsed = null;
  }
  const status = isRecord(parsed) ? parsed : {};
  return {
    loggedIn: exitCode === 0 && status.loggedIn !== false,
    authMethod: typeof status.authMethod === 'string' ? status.authMethod : null,
    subscriptionType:
      typeof status.subscriptionType === 'string' ? status.subscriptionType : null,
  };
}

export const CLAUDE_STATUS_ARGS = ['auth', 'status'];

/**
 * @typedef {object} CliJobContext
 * @property {string} cliPath
 * @property {AnalyzeRequest} request
 * @property {string} jobDir Private temp dir, used as the working directory.
 * @property {Record<string, string>} env
 * @property {AbortSignal} signal
 * @property {RunCli} run
 * @property {(line: string) => void} [debug]
 */

/**
 * @param {CliJobContext} context
 * @returns {Promise<CliOutput>}
 */
export async function runClaude({ cliPath, request, jobDir, env, signal, run, debug }) {
  const parser = new ClaudeStreamParser(debug);
  const outcome = await run({
    command: cliPath,
    args: buildClaudeArgs(request),
    cwd: jobDir,
    env,
    input: buildClaudeInput(request),
    signal,
    onStdout: (chunk) => parser.push(chunk),
  });
  parser.end();
  const { output, usage } = interpretClaudeResult(parser.result, outcome);
  return { output, model: parser.model, usage };
}
