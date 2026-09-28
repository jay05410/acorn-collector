/**
 * AIProvider 'cli': runs extraction on the user's own logged-in Claude Code
 * or Codex CLI through the native bridge. The prompt and output schema are
 * owned by the AI engine and injected, so this module does not depend on it.
 */
import type {
  AIProvider,
  ExtractionRequest,
  ProviderRawResult,
  WireExtraction,
} from '@/lib/ai/types';
import { ITEM_CATEGORIES } from '@/types';
import { getBridgeClient, type BridgeClient } from './client';
import { bridgeError } from './errors';
import type { CliTarget } from './protocol';

/**
 * CLI model aliases used when the user has not picked a model. '' lets Codex
 * use its own configured default. Move into src/lib/ai/models.ts when the
 * engine's model table lands.
 */
export const CLI_DEFAULT_MODELS: Record<CliTarget, string> = {
  claude: 'sonnet',
  codex: '',
};

/**
 * Model names each CLI plausibly accepts: Claude Code aliases or claude-*
 * IDs (with an optional [1m] suffix); OpenAI gpt-* or o-series IDs.
 */
const CLI_MODEL_PATTERNS: Record<CliTarget, RegExp> = {
  claude: /^(?:sonnet|opus|haiku|fable|claude-[a-z0-9.-]+)(?:\[1m\])?$/i,
  codex: /^(?:gpt-|o\d)/i,
};

/**
 * AISettings.cli.model is shared by both targets, so a model picked for one
 * CLI can reach the other after the target changes. Such a model is replaced
 * by the target's default instead of failing the run.
 */
export function resolveCliModel(
  target: CliTarget,
  model: string
): { model: string; replaced: boolean } {
  if (!model) return { model: CLI_DEFAULT_MODELS[target], replaced: false };
  if (CLI_MODEL_PATTERNS[target].test(model)) return { model, replaced: false };
  return { model: CLI_DEFAULT_MODELS[target], replaced: true };
}

export interface CliPrompt {
  /** Instructions (Claude Code system prompt; prepended for Codex). */
  system: string;
  /** User message text: the post text plus any per-request hints. */
  text: string;
}

export interface CliProviderConfig {
  /** CLI to run (AISettings.cli.target); read on every call. */
  getTarget: () => CliTarget;
  /** Engine-owned prompt for one request. */
  buildPrompt: (req: ExtractionRequest) => CliPrompt;
  /** JSON Schema of WireExtraction (the engine's WIRE_SCHEMA). */
  schema: Record<string, unknown>;
  client?: Pick<BridgeClient, 'analyze' | 'status'>;
}

export function createCliProvider(config: CliProviderConfig): AIProvider {
  const client = () => config.client ?? getBridgeClient();

  return {
    id: 'cli',

    defaultModel: () => CLI_DEFAULT_MODELS[config.getTarget()],

    async extract(req, opts): Promise<ProviderRawResult> {
      const target = config.getTarget();
      const { model, replaced } = resolveCliModel(target, opts.model);
      if (replaced) {
        console.warn(
          `[cli] model "${opts.model}" is not a ${target} model; using the ${target} default`
        );
      }
      const { system, text } = config.buildPrompt(req);
      const result = await client().analyze(
        {
          target,
          model,
          system,
          text,
          images: req.images.map(({ mimeType, base64 }) => ({
            mimeType,
            base64,
          })),
          schema: config.schema,
        },
        opts.signal ?? req.signal
      );
      if (!isWireExtraction(result.output)) {
        throw bridgeError(
          'bad_response',
          'cli_bad_output',
          'output does not match WireExtraction'
        );
      }
      const raw: ProviderRawResult = {
        wire: result.output,
        model: result.model ?? (model || `${target}-default`),
      };
      if (result.usage?.inputTokens !== undefined)
        raw.inputTokens = result.usage.inputTokens;
      if (result.usage?.outputTokens !== undefined)
        raw.outputTokens = result.usage.outputTokens;
      return raw;
    },

    async testConnection(): Promise<void> {
      const status = await client().status();
      const target = status.targets[config.getTarget()];
      if (!target.installed)
        throw bridgeError('not_configured', 'cli_not_installed');
      // loggedIn is false when the check itself failed; that is not a
      // login problem, so report it separately.
      if (target.warnings.includes('status_check_failed'))
        throw bridgeError(
          'unavailable',
          'cli_status_check_failed',
          'status_check_failed'
        );
      if (!target.loggedIn) throw bridgeError('auth', 'cli_not_logged_in');
    },
  };
}

type UnknownRecord = Record<string, unknown>;

const ITEM_CATEGORY_SET: ReadonlySet<unknown> = new Set(ITEM_CATEGORIES);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isNullableString = (value: unknown) =>
  value === null || typeof value === 'string';

function isWireItem(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    isNullableString(value.orig) &&
    (value.price === null ||
      (typeof value.price === 'number' && Number.isFinite(value.price))) &&
    ITEM_CATEGORY_SET.has(value.cat) &&
    Array.isArray(value.opts) &&
    value.opts.every((opt) => typeof opt === 'string')
  );
}

/** Structural check of CLI output before it is typed as WireExtraction. */
export function isWireExtraction(value: unknown): value is WireExtraction {
  if (!isRecord(value) || !isRecord(value.booth)) return false;
  const { booth } = value;
  return (
    isNullableString(booth.number) &&
    isNullableString(booth.circle) &&
    isNullableString(booth.event) &&
    isNullableString(booth.zone) &&
    typeof booth.mailOrder === 'boolean' &&
    isNullableString(value.currency) &&
    Array.isArray(value.items) &&
    value.items.every(isWireItem)
  );
}
