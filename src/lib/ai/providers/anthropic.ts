/**
 * Anthropic Messages API adapter (raw fetch; no SDK dependency in the
 * extension bundle). Structured output via `output_config.format`, streamed
 * as `content_block_delta`/`text_delta`. The direct-browser-access header is
 * Anthropic's opt-in for requests carrying a browser Origin (extension pages
 * send chrome-extension://...).
 */
import { numberField, recordField, stringField } from '../guards';
import { anthropicTuning, defaultModelFor } from '../models';
import { buildUserContent, systemPromptFor } from '../prompt';
import { parseWireJson, WIRE_SCHEMA_ANY_OF } from '../schema';
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

const API_BASE = 'https://api.anthropic.com/v1';
const API_VERSION = '2023-06-01';

const TYPE_MAP: Readonly<Record<string, AIErrorCode>> = {
  authentication_error: 'auth',
  permission_error: 'auth',
  billing_error: 'quota',
  rate_limit_error: 'rate_limit',
  overloaded_error: 'unavailable',
  api_error: 'unavailable',
  timeout_error: 'timeout',
};

export function classifyAnthropicError(info: ProviderErrorInfo): AIErrorCode {
  const byType = info.type ? TYPE_MAP[info.type] : undefined;
  if (byType) return byType;
  // Accounts without prepaid credit have been rejected with a 400 whose
  // message names the credit balance rather than a billing_error type.
  if (info.status === 400 && /credit balance/i.test(info.message)) return 'quota';
  return classifyStatus(info.status);
}

function headers(apiKey: string): HeadersInit {
  return {
    'x-api-key': apiKey,
    'anthropic-version': API_VERSION,
    'anthropic-dangerous-direct-browser-access': 'true',
    'content-type': 'application/json',
  };
}

function context(apiKey: string, signal: AbortSignal | undefined): RequestContext {
  return { provider: 'anthropic', apiKey, classify: classifyAnthropicError, signal };
}

export function buildAnthropicRequest(req: ExtractionRequest, model: string): Record<string, unknown> {
  const tuning = anthropicTuning(model);
  return {
    model,
    max_tokens: tuning.maxTokens,
    system: systemPromptFor(req.targetLanguage),
    messages: [
      {
        role: 'user',
        content: [
          // Images before text, as Anthropic recommends for vision prompts.
          ...req.images.map((image) => ({
            type: 'image',
            source: { type: 'base64', media_type: image.mimeType, data: image.base64 },
          })),
          { type: 'text', text: buildUserContent(req.text, req.hints) },
        ],
      },
    ],
    output_config: {
      format: { type: 'json_schema', schema: WIRE_SCHEMA_ANY_OF },
      ...(tuning.effort ? { effort: tuning.effort } : {}),
    },
    ...(tuning.disableThinking ? { thinking: { type: 'disabled' } } : {}),
    stream: true,
  };
}

interface StreamState {
  text: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  stopReason?: string;
  stopped: boolean;
}

function inputTokensOf(usage: Record<string, unknown> | undefined): number | undefined {
  const base = numberField(usage?.input_tokens);
  if (base === undefined) return undefined;
  return (
    base +
    (numberField(usage?.cache_creation_input_tokens) ?? 0) +
    (numberField(usage?.cache_read_input_tokens) ?? 0)
  );
}

/** Applies one stream event. Throws AIError for `error` events. */
export function applyAnthropicEvent(
  event: Record<string, unknown>,
  state: StreamState,
  apiKey: string,
  onText?: (textSoFar: string) => void
): void {
  switch (event.type) {
    case 'message_start': {
      const message = recordField(event, 'message');
      state.model = stringField(message?.model) ?? state.model;
      state.inputTokens = inputTokensOf(message ? recordField(message, 'usage') : undefined);
      return;
    }
    case 'content_block_delta': {
      const delta = recordField(event, 'delta');
      const text = delta?.type === 'text_delta' ? stringField(delta.text) : undefined;
      if (text) {
        state.text += text;
        onText?.(state.text);
      }
      return;
    }
    case 'message_delta': {
      const delta = recordField(event, 'delta');
      const usage = recordField(event, 'usage');
      state.stopReason = stringField(delta?.stop_reason) ?? state.stopReason;
      // message_delta usage is cumulative; keep the latest values.
      state.outputTokens = numberField(usage?.output_tokens) ?? state.outputTokens;
      state.inputTokens = inputTokensOf(usage) ?? state.inputTokens;
      return;
    }
    case 'message_stop':
      state.stopped = true;
      return;
    case 'error': {
      const info = errorInfoFromBody(event, undefined, apiKey);
      throw new AIError(classifyAnthropicError(info), info.message, 'anthropic');
    }
    default:
      // ping, content_block_start/stop and future event types.
      return;
  }
}

function checkStopReason(stopReason: string | undefined): void {
  if (stopReason === 'refusal') {
    throw new AIError('refused', 'The model declined to process this content', 'anthropic');
  }
  if (stopReason === 'max_tokens') {
    throw new AIError('bad_response', 'The response hit the output token limit', 'anthropic');
  }
}

export async function extractWithAnthropic(
  req: ExtractionRequest,
  opts: ProviderCallOptions
): Promise<ProviderRawResult> {
  const signal = opts.signal ?? req.signal;
  const response = await send(
    `${API_BASE}/messages`,
    {
      method: 'POST',
      headers: headers(opts.apiKey),
      body: JSON.stringify(buildAnthropicRequest(req, opts.model)),
    },
    context(opts.apiKey, signal)
  );
  const state: StreamState = { text: '', model: opts.model, stopped: false };
  for await (const message of streamMessages(response, 'anthropic', signal)) {
    applyAnthropicEvent(parseEventData(message.data, 'anthropic'), state, opts.apiKey, opts.onText);
    if (state.stopped) break;
  }
  if (!state.stopped) throw streamEndedEarly('anthropic');
  checkStopReason(state.stopReason);
  return {
    wire: parseWireJson(state.text, 'anthropic'),
    model: state.model,
    inputTokens: state.inputTokens,
    outputTokens: state.outputTokens,
  };
}

export const anthropicProvider: AIProvider = {
  id: 'anthropic',
  defaultModel: (tier) => defaultModelFor('anthropic', tier),
  extract: extractWithAnthropic,
  async testConnection({ apiKey, signal }) {
    await getJson(`${API_BASE}/models?limit=1`, headers(apiKey), context(apiKey, signal));
  },
};
