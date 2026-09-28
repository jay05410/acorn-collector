/**
 * OpenAI Responses API adapter: strict JSON-schema output, streamed with
 * `response.output_text.delta`. `store: false` keeps the request out of
 * OpenAI's response storage (ADR-001: nothing persisted server-side).
 */
import { numberField, recordField, stringField } from '../guards';
import { toDataUrl } from '../image';
import { defaultModelFor, openAITuning } from '../models';
import { buildUserContent, systemPromptFor } from '../prompt';
import { parseWireJson, WIRE_SCHEMA } from '../schema';
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

const API_BASE = 'https://api.openai.com/v1';

const CODE_MAP: Readonly<Record<string, AIErrorCode>> = {
  insufficient_quota: 'quota',
  rate_limit_exceeded: 'rate_limit',
  invalid_api_key: 'auth',
  server_error: 'unavailable',
};

export function classifyOpenAIError(info: ProviderErrorInfo): AIErrorCode {
  const byCode = info.code ? CODE_MAP[info.code] : undefined;
  return byCode ?? classifyStatus(info.status);
}

function headers(apiKey: string): HeadersInit {
  return { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' };
}

function context(apiKey: string, signal: AbortSignal | undefined): RequestContext {
  return { provider: 'openai', apiKey, classify: classifyOpenAIError, signal };
}

export function buildOpenAIRequest(req: ExtractionRequest, model: string): Record<string, unknown> {
  const tuning = openAITuning(model, req.tier);
  return {
    model,
    instructions: systemPromptFor(req.targetLanguage),
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: buildUserContent(req.text, req.hints) },
          ...req.images.map((image) => ({
            type: 'input_image',
            image_url: toDataUrl(image),
            detail: 'high',
          })),
        ],
      },
    ],
    text: {
      format: { type: 'json_schema', name: 'booth_extraction', strict: true, schema: WIRE_SCHEMA },
    },
    ...(tuning.effort ? { reasoning: { effort: tuning.effort } } : {}),
    max_output_tokens: tuning.maxOutputTokens,
    store: false,
    stream: true,
  };
}

interface StreamState {
  text: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  completed: boolean;
}

function streamError(event: Record<string, unknown>, apiKey: string): AIError {
  // `error` events carry code/message at the top level; `response.failed`
  // nests them under response.error.
  const response = recordField(event, 'response');
  const payload = event.type === 'error' ? event : response && recordField(response, 'error');
  const info = errorInfoFromBody({ error: payload }, undefined, apiKey);
  return new AIError(classifyOpenAIError(info), info.message, 'openai');
}

/** Applies one stream event. Throws AIError on refusal, truncation or failure. */
export function applyOpenAIEvent(
  event: Record<string, unknown>,
  state: StreamState,
  apiKey: string,
  onText?: (textSoFar: string) => void
): void {
  switch (event.type) {
    case 'response.output_text.delta': {
      const delta = stringField(event.delta);
      if (delta) {
        state.text += delta;
        onText?.(state.text);
      }
      return;
    }
    case 'response.refusal.done':
      throw new AIError('refused', stringField(event.refusal) ?? 'The model refused the request', 'openai');
    case 'response.completed': {
      const response = recordField(event, 'response');
      const usage = response ? recordField(response, 'usage') : undefined;
      state.model = stringField(response?.model) ?? state.model;
      state.inputTokens = numberField(usage?.input_tokens);
      state.outputTokens = numberField(usage?.output_tokens);
      state.completed = true;
      return;
    }
    case 'response.incomplete': {
      const response = recordField(event, 'response');
      const details = response ? recordField(response, 'incomplete_details') : undefined;
      const reason = stringField(details?.reason) ?? 'unknown';
      if (reason === 'content_filter') {
        throw new AIError('refused', 'The response was blocked by a content filter', 'openai');
      }
      throw new AIError('bad_response', `The response is incomplete (${reason})`, 'openai');
    }
    case 'response.failed':
    case 'error':
      throw streamError(event, apiKey);
    default:
      return;
  }
}

export async function extractWithOpenAI(
  req: ExtractionRequest,
  opts: ProviderCallOptions
): Promise<ProviderRawResult> {
  const signal = opts.signal ?? req.signal;
  const response = await send(
    `${API_BASE}/responses`,
    {
      method: 'POST',
      headers: headers(opts.apiKey),
      body: JSON.stringify(buildOpenAIRequest(req, opts.model)),
    },
    context(opts.apiKey, signal)
  );
  const state: StreamState = { text: '', model: opts.model, completed: false };
  for await (const message of streamMessages(response, 'openai', signal)) {
    applyOpenAIEvent(parseEventData(message.data, 'openai'), state, opts.apiKey, opts.onText);
    if (state.completed) break;
  }
  if (!state.completed) throw streamEndedEarly('openai');
  return {
    wire: parseWireJson(state.text, 'openai'),
    model: state.model,
    inputTokens: state.inputTokens,
    outputTokens: state.outputTokens,
  };
}

export const openaiProvider: AIProvider = {
  id: 'openai',
  defaultModel: (tier) => defaultModelFor('openai', tier),
  extract: extractWithOpenAI,
  async testConnection({ apiKey, signal }) {
    await getJson(`${API_BASE}/models`, headers(apiKey), context(apiKey, signal));
  },
};
