/**
 * The OpenRouter "paste a code" flow spans a tab switch, and the side panel
 * can reload meanwhile. Its PKCE verifier is kept in chrome.storage.session
 * (memory only, extension pages only) until the code is exchanged or the
 * user cancels.
 */
import {
  exchangeCode,
  parseAuthCode,
  type ExchangeCodeOptions,
  type OpenRouterCredentials,
} from '@/lib/ai/openrouter-oauth';
import { AIError } from '@/lib/ai/types';

export const HEADLESS_FLOW_KEY = 'openrouter:headless-flow';
/**
 * A code is valid for 10 minutes after the user approves, which can be a
 * while after the flow started; older flows are dropped.
 */
export const HEADLESS_FLOW_MAX_AGE_MS = 30 * 60 * 1000;

export interface PendingHeadlessFlow {
  authUrl: string;
  verifier: string;
  createdAt: number;
}

type SessionArea = Pick<
  chrome.storage.SessionStorageArea,
  'get' | 'set' | 'remove'
>;

function sessionArea(): SessionArea {
  return chrome.storage.session;
}

function isPendingFlow(value: unknown): value is PendingHeadlessFlow {
  if (typeof value !== 'object' || value === null) return false;
  const flow = value as Record<string, unknown>;
  return (
    typeof flow.authUrl === 'string' &&
    flow.authUrl.startsWith('https://') &&
    typeof flow.verifier === 'string' &&
    flow.verifier !== '' &&
    typeof flow.createdAt === 'number' &&
    Number.isFinite(flow.createdAt)
  );
}

export async function savePendingFlow(
  flow: PendingHeadlessFlow,
  area: SessionArea = sessionArea()
): Promise<void> {
  await area.set({ [HEADLESS_FLOW_KEY]: flow });
}

/** The saved flow, or null when there is none or it is stale or malformed. */
export async function loadPendingFlow(
  now: number = Date.now(),
  area: SessionArea = sessionArea()
): Promise<PendingHeadlessFlow | null> {
  const items = await area.get(HEADLESS_FLOW_KEY);
  const value: unknown = items[HEADLESS_FLOW_KEY];
  if (value === undefined) return null;
  const age = isPendingFlow(value) ? now - value.createdAt : Number.NaN;
  if (age >= 0 && age <= HEADLESS_FLOW_MAX_AGE_MS) {
    return value as PendingHeadlessFlow;
  }
  await area.remove(HEADLESS_FLOW_KEY);
  return null;
}

export async function clearPendingFlow(
  area: SessionArea = sessionArea()
): Promise<void> {
  await area.remove(HEADLESS_FLOW_KEY);
}

/**
 * Exchanges a pasted code (or a pasted URL containing it) with the saved
 * verifier. Works after a reload, when the createHeadlessFlow() closure is
 * gone. Throws AIError; 'auth' when nothing code-like was pasted.
 */
export async function completePendingFlow(
  flow: Pick<PendingHeadlessFlow, 'verifier'>,
  pasted: string,
  signal?: AbortSignal,
  exchange: (options: ExchangeCodeOptions) => Promise<OpenRouterCredentials> = exchangeCode
): Promise<OpenRouterCredentials> {
  const code = parseAuthCode(pasted);
  if (!code) {
    throw new AIError(
      'auth',
      'That does not look like an OpenRouter code',
      'openrouter'
    );
  }
  return exchange({ code, verifier: flow.verifier, signal });
}
