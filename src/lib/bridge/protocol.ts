/**
 * Wire protocol shared with the native host (native-host/lib/server.mjs,
 * native-host/lib/validate.mjs). Keep both sides in sync.
 */
import type { ImageInput } from '@/lib/ai/types';
import type { CliBridgeSettings } from '@/lib/settings-types';

export const BRIDGE_HOST_NAME = 'com.acorn_collector.bridge';
export const BRIDGE_PROTOCOL_VERSION = 1;
/**
 * Largest analyze payload the host accepts (MAX_PAYLOAD_BYTES in
 * native-host/lib/validate.mjs), measured by analyzePayloadBytes().
 */
export const BRIDGE_MAX_PAYLOAD_BYTES = 28 * 1024 * 1024;

export type CliTarget = CliBridgeSettings['target'];

export interface BridgeImage {
  mimeType: ImageInput['mimeType'];
  /** Base64 without the data: prefix. */
  base64: string;
}

/** One analysis run on the user's CLI. */
export interface BridgeAnalyzeRequest {
  target: CliTarget;
  /** CLI model alias or ID; '' uses the CLI's default model. */
  model: string;
  system: string;
  text: string;
  images: BridgeImage[];
  /** JSON Schema the structured output must match. */
  schema: Record<string, unknown>;
}

const utf8 = new TextEncoder();

/**
 * Encoded size of an analyze request: image base64 plus the UTF-8 JSON of
 * system, text and schema. Same measure as payloadBytes() in
 * native-host/lib/validate.mjs.
 */
export function analyzePayloadBytes(
  request: Pick<BridgeAnalyzeRequest, 'system' | 'text' | 'images' | 'schema'>
): number {
  let size = 0;
  for (const image of request.images) size += image.base64.length;
  for (const value of [request.system, request.text, request.schema]) {
    size += utf8.encode(JSON.stringify(value)).length;
  }
  return size;
}

export type BridgeRequest =
  | { id: string; op: 'ping' }
  | { id: string; op: 'status' }
  | { id: string; op: 'cancel'; targetId: string }
  | ({ id: string; op: 'analyze' } & BridgeAnalyzeRequest);

export const BRIDGE_HOST_ERROR_CODES = [
  'bad_request',
  'busy',
  'cancelled',
  'timeout',
  'cli_not_found',
  'not_logged_in',
  'rate_limited',
  'cli_failed',
  'bad_output',
  'origin_not_allowed',
  'internal',
] as const;

export type BridgeHostErrorCode = (typeof BRIDGE_HOST_ERROR_CODES)[number];

export type BridgeResponse =
  | { id: string | null; status: 'queued' | 'running' }
  | { id: string | null; status: 'ok'; result: unknown }
  | {
      id: string | null;
      status: 'error';
      error: { code: BridgeHostErrorCode; message: string };
    };

export interface BridgeAnalyzeResult {
  /** Parsed structured output, still to be checked against the schema. */
  output: Record<string, unknown>;
  /** Model the CLI reported, if any. */
  model: string | null;
  usage: { inputTokens?: number; outputTokens?: number } | null;
}

export interface BridgeTargetStatus {
  installed: boolean;
  loggedIn: boolean;
  authMethod: string | null;
  subscriptionType: string | null;
  /** e.g. 'anthropic_api_key_ignored', 'status_check_failed'. */
  warnings: string[];
}

export interface BridgeStatus {
  protocol: number;
  platform: string;
  targets: Record<CliTarget, BridgeTargetStatus>;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHostErrorCode(value: unknown): value is BridgeHostErrorCode {
  return (BRIDGE_HOST_ERROR_CODES as readonly unknown[]).includes(value);
}

export function isBridgeResponse(value: unknown): value is BridgeResponse {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' && value.id !== null) return false;
  switch (value.status) {
    case 'queued':
    case 'running':
      return true;
    case 'ok':
      return 'result' in value;
    case 'error':
      return (
        isRecord(value.error) &&
        isHostErrorCode(value.error.code) &&
        typeof value.error.message === 'string'
      );
    default:
      return false;
  }
}

function isOptionalCount(value: unknown): boolean {
  return (
    value === undefined || (typeof value === 'number' && Number.isFinite(value))
  );
}

export function isBridgeAnalyzeResult(
  value: unknown
): value is BridgeAnalyzeResult {
  if (!isRecord(value) || !isRecord(value.output)) return false;
  if (typeof value.model !== 'string' && value.model !== null) return false;
  if (value.usage === null) return true;
  return (
    isRecord(value.usage) &&
    isOptionalCount(value.usage.inputTokens) &&
    isOptionalCount(value.usage.outputTokens)
  );
}

function isTargetStatus(value: unknown): value is BridgeTargetStatus {
  return (
    isRecord(value) &&
    typeof value.installed === 'boolean' &&
    typeof value.loggedIn === 'boolean' &&
    (typeof value.authMethod === 'string' || value.authMethod === null) &&
    (typeof value.subscriptionType === 'string' ||
      value.subscriptionType === null) &&
    Array.isArray(value.warnings) &&
    value.warnings.every((warning) => typeof warning === 'string')
  );
}

export function isBridgeStatus(value: unknown): value is BridgeStatus {
  return (
    isRecord(value) &&
    typeof value.protocol === 'number' &&
    typeof value.platform === 'string' &&
    isRecord(value.targets) &&
    isTargetStatus(value.targets.claude) &&
    isTargetStatus(value.targets.codex)
  );
}
