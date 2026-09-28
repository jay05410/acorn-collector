/**
 * HTTP plumbing shared by the provider adapters: request with error mapping,
 * SSE iteration with abort/timeout mapping, and secret redaction so API keys
 * never reach error messages.
 */
import { toAIError } from '../errors';
import { isRecord, numberField, recordField, stringField } from '../guards';
import { readSSE, type SSEMessage } from '../sse';
import { AIError, type AIErrorCode, type ProviderId } from '../types';

export interface ProviderErrorInfo {
  /** HTTP status, or the status-like code carried by a stream error event. */
  status?: number;
  /** Provider error type, e.g. "overloaded_error" (Anthropic). */
  type?: string;
  /** Provider error code, e.g. "insufficient_quota" (OpenAI). */
  code?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export type ErrorClassifier = (info: ProviderErrorInfo) => AIErrorCode;

/** Generic HTTP status mapping; provider classifiers refine it. */
export function classifyStatus(status: number | undefined): AIErrorCode {
  if (status === undefined) return 'unknown';
  if (status === 401 || status === 403) return 'auth';
  if (status === 402) return 'quota';
  if (status === 408) return 'timeout';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'unavailable';
  return 'unknown';
}

const KEY_LIKE = /\bsk-[\w*.-]{4,}/g;
const MAX_MESSAGE_CHARS = 300;

export function redactSecrets(text: string, apiKey: string): string {
  const withoutKey = apiKey ? text.split(apiKey).join('[redacted]') : text;
  return withoutKey.replace(KEY_LIKE, 'sk-[redacted]').slice(0, MAX_MESSAGE_CHARS);
}

/** Reads `{error: {...}}` bodies (OpenAI, Anthropic and OpenRouter all use it). */
export function errorInfoFromBody(body: unknown, status: number | undefined, apiKey: string): ProviderErrorInfo {
  const error = isRecord(body) ? recordField(body, 'error') : undefined;
  const rawCode = error?.code;
  const code =
    typeof rawCode === 'string' ? rawCode : typeof rawCode === 'number' ? String(rawCode) : undefined;
  const message = stringField(error?.message) ?? (status ? `HTTP ${status}` : 'Provider error');
  return {
    status: status ?? numberField(rawCode),
    type: stringField(error?.type),
    code,
    message: redactSecrets(message, apiKey),
    metadata: error ? recordField(error, 'metadata') : undefined,
  };
}

async function errorInfoFromResponse(response: Response, apiKey: string): Promise<ProviderErrorInfo> {
  const text = await response.text().catch(() => '');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }
  return errorInfoFromBody(body, response.status, apiKey);
}

export interface RequestContext {
  provider: ProviderId;
  apiKey: string;
  classify: ErrorClassifier;
  signal?: AbortSignal;
}

/** fetch() that throws AIError for transport failures and non-2xx statuses. */
export async function send(url: string, init: RequestInit, ctx: RequestContext): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: ctx.signal, credentials: 'omit' });
  } catch (error) {
    throw toAIError(error, ctx.provider, ctx.signal);
  }
  if (!response.ok) {
    const info = await errorInfoFromResponse(response, ctx.apiKey);
    throw new AIError(ctx.classify(info), info.message, ctx.provider, response.status);
  }
  return response;
}

export async function getJson(url: string, headers: HeadersInit, ctx: RequestContext): Promise<unknown> {
  const response = await send(url, { method: 'GET', headers }, ctx);
  try {
    return await response.json();
  } catch (error) {
    if (ctx.signal?.aborted) throw toAIError(error, ctx.provider, ctx.signal);
    throw new AIError('bad_response', 'Response is not valid JSON', ctx.provider);
  }
}

/** Iterates SSE messages, mapping read failures (abort, timeout, drop) to AIError. */
export async function* streamMessages(
  response: Response,
  provider: ProviderId,
  signal: AbortSignal | undefined
): AsyncGenerator<SSEMessage> {
  if (!response.body) throw new AIError('bad_response', 'Response has no body', provider);
  try {
    yield* readSSE(response.body);
  } catch (error) {
    throw toAIError(error, provider, signal);
  }
}

export function parseEventData(data: string, provider: ProviderId): Record<string, unknown> {
  let event: unknown;
  try {
    event = JSON.parse(data);
  } catch {
    throw new AIError('bad_response', 'Stream event is not valid JSON', provider);
  }
  if (!isRecord(event)) throw new AIError('bad_response', 'Stream event is not an object', provider);
  return event;
}

export function streamEndedEarly(provider: ProviderId): AIError {
  return new AIError('network', 'The response stream ended before completion', provider);
}
