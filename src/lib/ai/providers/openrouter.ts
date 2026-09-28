/**
 * OpenRouter chat-completions adapter. `provider.require_parameters` keeps
 * routing on upstreams that honor response_format and reasoning; the key is
 * user-owned (OAuth PKCE in ../openrouter-oauth.ts or pasted manually).
 */
import { isRecord, numberField, recordField, stringField } from '../guards';
import { toDataUrl } from '../image';
import { defaultModelFor, openRouterTuning } from '../models';
import { buildUserContent, systemPromptFor } from '../prompt';
import { parseWireJson, wireSchema } from '../schema';
import {
  AIError,
  type AIErrorCode,
  type AIProvider,
  type ExtractionRequest,
  type ProviderCallOptions,
  type ProviderRawResult,
} from '../types';
import {
  classifyStatus,
  errorInfoFromBody,
  getJson,
  parseEventData,
  send,
  streamEndedEarly,
  streamMessages,
  type ProviderErrorInfo,
  type RequestContext,
} from './http';

export const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
/** App attribution shown on openrouter.ai. */
const APP_URL = 'https://github.com/jay05410/acorn-collector';
const APP_TITLE = 'Acorn Collector';

/**
 * Typed error codes (https://openrouter.ai/docs/api-reference/errors) that can
 * arrive as a string `error.code` in mid-stream error chunks (the streaming
 * docs show `"code":"server_error"`) or as `metadata.error_type`.
 */
const TYPED_ERROR_CODES: Readonly<Record<string, AIErrorCode>> = {
  rate_limit_exceeded: 'rate_limit',
  timeout: 'timeout',
  server: 'unavailable',
  server_error: 'unavailable',
  provider_overloaded: 'unavailable',
  provider_unavailable: 'unavailable',
  unmapped: 'unavailable',
  content_policy_violation: 'refused',
  refusal: 'refused',
};

export function classifyOpenRouterError(info: ProviderErrorInfo): AIErrorCode {
  // 403 is also used for moderation blocks, which carry metadata.reasons.
  const moderated = info.metadata !== undefined && 'reasons' in info.metadata;
  if (moderated && (info.status === 403 || info.status === undefined)) return 'refused';
  if (info.status !== undefined) return classifyStatus(info.status);
  const typed = [info.code, stringField(info.metadata?.error_type)]
    .map((code) => (code === undefined ? undefined : TYPED_ERROR_CODES[code]))
    .find((code) => code !== undefined);
  return typed ?? 'unknown';
}

function headers(apiKey: string): HeadersInit {
  return {
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json',
    'HTTP-Referer': APP_URL,
    'X-OpenRouter-Title': APP_TITLE,
  };
}

function context(apiKey: string, signal: AbortSignal | undefined): RequestContext {
  return { provider: 'openrouter', apiKey, classify: classifyOpenRouterError, signal };
}

export function buildOpenRouterRequest(req: ExtractionRequest, model: string): Record<string, unknown> {
  const tuning = openRouterTuning(model, req.tier);
  return {
    model,
    messages: [
      { role: 'system', content: systemPromptFor(req.targetLanguage) },
      {
        role: 'user',
        content: [
          { type: 'text', text: buildUserContent(req.text, req.hints) },
          ...req.images.map((image) => ({ type: 'image_url', image_url: { url: toDataUrl(image) } })),
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'booth_extraction', strict: true, schema: wireSchema(tuning.schemaStyle) },
    },
    ...(tuning.reasoning ? { reasoning: tuning.reasoning } : {}),
    provider: { require_parameters: true },
    max_tokens: tuning.maxTokens,
    stream: true,
  };
}

interface StreamState {
  text: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  finishReason?: string;
  done: boolean;
}

/** Applies one chunk. Throws AIError for mid-stream errors and refusals. */
export function applyOpenRouterChunk(
  chunk: Record<string, unknown>,
  state: StreamState,
  apiKey: string,
  onText?: (textSoFar: string) => void
): void {
  const choice = Array.isArray(chunk.choices) ? chunk.choices[0] : undefined;
  if (isRecord(chunk.error)) {
    // Mid-stream failures arrive as HTTP 200 chunks carrying {error: {code, message}}
    // and finish_reason 'error'; the code is an HTTP status or a string.
    const info = errorInfoFromBody(chunk, undefined, apiKey);
    let code = classifyOpenRouterError(info);
    // An unrecognized string code that ends the stream is an upstream failure,
    // retryable like finish_reason 'error' without an error object.
    if (code === 'unknown' && info.status === undefined && isRecord(choice) && choice.finish_reason === 'error') {
      code = 'unavailable';
    }
    throw new AIError(code, info.message, 'openrouter', info.status);
  }
  state.model = stringField(chunk.model) ?? state.model;
  const usage = recordField(chunk, 'usage');
  if (usage) {
    state.inputTokens = numberField(usage.prompt_tokens) ?? state.inputTokens;
    state.outputTokens = numberField(usage.completion_tokens) ?? state.outputTokens;
  }
  if (!isRecord(choice)) return;
  const delta = recordField(choice, 'delta');
  const refusal = stringField(delta?.refusal);
  if (refusal) throw new AIError('refused', refusal, 'openrouter');
  const content = stringField(delta?.content);
  if (content) {
    state.text += content;
    onText?.(state.text);
  }
  state.finishReason = stringField(choice.finish_reason) ?? state.finishReason;
}

function checkFinishReason(finishReason: string | undefined): void {
  if (finishReason === 'length') {
    throw new AIError('bad_response', 'The response hit the output token limit', 'openrouter');
  }
  if (finishReason === 'content_filter') {
    throw new AIError('refused', 'The response was blocked by a content filter', 'openrouter');
  }
  if (finishReason === 'error') {
    throw new AIError('unavailable', 'The upstream provider failed mid-response', 'openrouter');
  }
}

export async function extractWithOpenRouter(
  req: ExtractionRequest,
  opts: ProviderCallOptions
): Promise<ProviderRawResult> {
  const signal = opts.signal ?? req.signal;
  const response = await send(
    `${OPENROUTER_API_BASE}/chat/completions`,
    {
      method: 'POST',
      headers: headers(opts.apiKey),
      body: JSON.stringify(buildOpenRouterRequest(req, opts.model)),
    },
    context(opts.apiKey, signal)
  );
  const state: StreamState = { text: '', model: opts.model, done: false };
  for await (const message of streamMessages(response, 'openrouter', signal)) {
    if (message.data === '[DONE]') {
      state.done = true;
      break;
    }
    applyOpenRouterChunk(parseEventData(message.data, 'openrouter'), state, opts.apiKey, opts.onText);
  }
  if (!state.done && state.finishReason === undefined) throw streamEndedEarly('openrouter');
  checkFinishReason(state.finishReason);
  return {
    wire: parseWireJson(state.text, 'openrouter'),
    model: state.model,
    inputTokens: state.inputTokens,
    outputTokens: state.outputTokens,
  };
}

export interface OpenRouterKeyInfo {
  label: string | null;
  /** Credit limit of the key; null means unlimited. */
  limit: number | null;
  /** Remaining credits under `limit`; null means unlimited. */
  limitRemaining: number | null;
  /** Reset period of the limit (e.g. "monthly"); null if it never resets. */
  limitReset: string | null;
  /** Credits used by the key, all time. */
  usage: number | null;
  isFreeTier: boolean;
}

/** GET /api/v1/key: validates the key and returns its spending limits. */
export async function getOpenRouterKeyInfo(
  apiKey: string,
  signal?: AbortSignal
): Promise<OpenRouterKeyInfo> {
  const body = await getJson(`${OPENROUTER_API_BASE}/key`, headers(apiKey), context(apiKey, signal));
  const data = isRecord(body) ? recordField(body, 'data') : undefined;
  if (!data) throw new AIError('bad_response', 'Unexpected key info response', 'openrouter');
  return {
    label: stringField(data.label) ?? null,
    limit: numberField(data.limit) ?? null,
    limitRemaining: numberField(data.limit_remaining) ?? null,
    limitReset: stringField(data.limit_reset) ?? null,
    usage: numberField(data.usage) ?? null,
    isFreeTier: data.is_free_tier === true,
  };
}

export const openrouterProvider: AIProvider = {
  id: 'openrouter',
  defaultModel: (tier) => defaultModelFor('openrouter', tier),
  extract: extractWithOpenRouter,
  async testConnection({ apiKey, signal }) {
    await getOpenRouterKeyInfo(apiKey, signal);
  },
};
