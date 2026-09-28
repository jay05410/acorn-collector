/**
 * The only place model IDs live (CONVENTIONS.md). Defaults and per-model
 * request tuning follow ADR-001 section 2; OpenRouter capabilities were read
 * from https://openrouter.ai/api/v1/models on 2026-09-29.
 */
import type { SchemaStyle } from './schema';
import type { ModelTier, ProviderId } from './types';

export type ApiProviderId = Exclude<ProviderId, 'cli'>;

const GPT_6_LUNA = 'gpt-6-luna';
const GPT_6_SOL = 'gpt-6-sol';
const CLAUDE_SONNET_5 = 'claude-sonnet-5';
const CLAUDE_OPUS_5_5 = 'claude-opus-5-5';
const OR_GPT_6_LUNA = 'openai/gpt-6-luna';
const OR_GPT_6_SOL = 'openai/gpt-6-sol';
const OR_CLAUDE_SONNET_5 = 'anthropic/claude-sonnet-5';
/** OpenRouter spells the version with a dot. */
const OR_CLAUDE_OPUS_5_5 = 'anthropic/claude-opus-5.5';
const OR_QWEN_3_6_35B = 'qwen/qwen3.6-35b-a3b';
const OR_QWEN_3_7_PLUS = 'qwen/qwen3.7-plus';
const OR_MISTRAL_SMALL = 'mistralai/mistral-small-2603';

export const MODEL_TABLE: Readonly<Record<ApiProviderId, Readonly<Record<ModelTier, string>>>> = {
  openai: { fast: GPT_6_LUNA, accurate: GPT_6_SOL },
  anthropic: { fast: CLAUDE_SONNET_5, accurate: CLAUDE_OPUS_5_5 },
  openrouter: { fast: OR_GPT_6_LUNA, accurate: OR_CLAUDE_SONNET_5 },
};

/** Options for the settings model dropdown, defaults first. All accept images. */
export const SELECTABLE_MODELS: Readonly<Record<ApiProviderId, readonly string[]>> = {
  openai: [GPT_6_LUNA, GPT_6_SOL],
  anthropic: [CLAUDE_SONNET_5, CLAUDE_OPUS_5_5],
  openrouter: [
    OR_GPT_6_LUNA,
    OR_CLAUDE_SONNET_5,
    OR_GPT_6_SOL,
    OR_CLAUDE_OPUS_5_5,
    OR_QWEN_3_6_35B,
    OR_QWEN_3_7_PLUS,
    OR_MISTRAL_SMALL,
  ],
};

export function defaultModelFor(provider: ApiProviderId, tier: ModelTier): string {
  return MODEL_TABLE[provider][tier];
}

/** Ceiling for streamed output; extraction JSON is usually < 3k tokens. */
const OUTPUT_TOKENS = 8192;
/** Headroom when the model also spends output tokens on reasoning. */
const OUTPUT_TOKENS_WITH_REASONING = 16000;

// ---------------------------------------------------------------------------
// Images

export interface ImageLimits {
  maxEdge: number;
  maxPixels?: number;
}

const DEFAULT_IMAGE_LIMITS: ImageLimits = { maxEdge: 2048 };
/** Claude high-resolution tier: 2576 px long edge, about 3.75 MP. */
const CLAUDE_HIGH_RES: ImageLimits = { maxEdge: 2576, maxPixels: 3_750_000 };

const IMAGE_LIMITS: Readonly<Record<string, ImageLimits>> = {
  [CLAUDE_SONNET_5]: CLAUDE_HIGH_RES,
  [CLAUDE_OPUS_5_5]: CLAUDE_HIGH_RES,
  [OR_CLAUDE_SONNET_5]: CLAUDE_HIGH_RES,
  [OR_CLAUDE_OPUS_5_5]: CLAUDE_HIGH_RES,
};

/** Largest image worth sending; bigger inputs are downscaled client-side. */
export function imageLimitsFor(model: string): ImageLimits {
  return IMAGE_LIMITS[model] ?? DEFAULT_IMAGE_LIMITS;
}

// ---------------------------------------------------------------------------
// OpenAI Responses API

export type OpenAIEffort = 'none' | 'low';

export interface OpenAITuning {
  /** Omitted for unknown models so they keep their own default. */
  effort?: OpenAIEffort;
  maxOutputTokens: number;
}

const OPENAI_EFFORT: Readonly<Record<string, Readonly<Record<ModelTier, OpenAIEffort>>>> = {
  [GPT_6_LUNA]: { fast: 'none', accurate: 'none' },
  [GPT_6_SOL]: { fast: 'none', accurate: 'low' },
};

export function openAITuning(model: string, tier: ModelTier): OpenAITuning {
  const effort = OPENAI_EFFORT[model]?.[tier];
  return {
    ...(effort ? { effort } : {}),
    maxOutputTokens: effort === 'none' ? OUTPUT_TOKENS : OUTPUT_TOKENS_WITH_REASONING,
  };
}

// ---------------------------------------------------------------------------
// Anthropic Messages API

export interface AnthropicTuning {
  /** Sends thinking {type:'disabled'} (accepted by Sonnet 5, rejected by Opus 5.5). */
  disableThinking: boolean;
  /** output_config.effort; Opus 5.5 cannot disable thinking, so it runs at 'low'. */
  effort?: 'low';
  maxTokens: number;
}

const ANTHROPIC_TUNING: Readonly<Record<string, AnthropicTuning>> = {
  [CLAUDE_SONNET_5]: { disableThinking: true, maxTokens: OUTPUT_TOKENS },
  [CLAUDE_OPUS_5_5]: {
    disableThinking: false,
    effort: 'low',
    maxTokens: OUTPUT_TOKENS_WITH_REASONING,
  },
};

export function anthropicTuning(model: string): AnthropicTuning {
  return (
    ANTHROPIC_TUNING[model] ?? {
      disableThinking: false,
      maxTokens: OUTPUT_TOKENS_WITH_REASONING,
    }
  );
}

// ---------------------------------------------------------------------------
// OpenRouter chat completions

export type OpenRouterReasoning = { effort: 'none' | 'low' } | { enabled: false };

export interface OpenRouterTuning {
  /** Omitted when the model's own default is already the fast path. */
  reasoning?: OpenRouterReasoning;
  schemaStyle: SchemaStyle;
  maxTokens: number;
}

const REASONING_OFF: OpenRouterReasoning = { enabled: false };
const EFFORT_NONE: OpenRouterReasoning = { effort: 'none' };
const EFFORT_LOW: OpenRouterReasoning = { effort: 'low' };

/**
 * Catalog facts: GPT-6 supports effort 'none'; Claude Sonnet 5 has no 'none'
 * effort but reasoning is optional; Claude Opus 5.5 reasoning is mandatory;
 * Qwen reasoning is on by default and optional; Mistral Small 2603 is off by
 * default (so it gets no reasoning field).
 */
const OPENROUTER_REASONING: Readonly<
  Record<string, Readonly<Record<ModelTier, OpenRouterReasoning>>>
> = {
  [OR_GPT_6_LUNA]: { fast: EFFORT_NONE, accurate: EFFORT_NONE },
  [OR_GPT_6_SOL]: { fast: EFFORT_NONE, accurate: EFFORT_LOW },
  [OR_CLAUDE_SONNET_5]: { fast: REASONING_OFF, accurate: REASONING_OFF },
  [OR_CLAUDE_OPUS_5_5]: { fast: EFFORT_LOW, accurate: EFFORT_LOW },
  [OR_QWEN_3_6_35B]: { fast: REASONING_OFF, accurate: REASONING_OFF },
  [OR_QWEN_3_7_PLUS]: { fast: REASONING_OFF, accurate: REASONING_OFF },
};

export function openRouterTuning(model: string, tier: ModelTier): OpenRouterTuning {
  const reasoning = OPENROUTER_REASONING[model]?.[tier];
  const reasoningOff =
    reasoning !== undefined && ('enabled' in reasoning || reasoning.effort === 'none');
  return {
    ...(reasoning ? { reasoning } : {}),
    // Claude upstreams document anyOf, not type arrays (see schema.ts).
    schemaStyle: model.startsWith('anthropic/') ? 'any-of' : 'type-array',
    maxTokens: reasoningOff ? OUTPUT_TOKENS : OUTPUT_TOKENS_WITH_REASONING,
  };
}
