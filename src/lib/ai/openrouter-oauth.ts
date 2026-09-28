/**
 * OpenRouter OAuth PKCE (https://openrouter.ai/docs/use-cases/oauth-pkce):
 * the user authorizes on openrouter.ai and we exchange the one-time code for
 * a user-owned API key. Two flows:
 * - connectWithRedirect: chrome.identity web auth flow with the extension's
 *   chromiumapp.org callback (needs the "identity" permission).
 * - createHeadlessFlow: no callback_url; openrouter.ai shows the code and the
 *   user pastes it back (fallback if the redirect is not accepted).
 */
import { bytesToBase64Url, sha256 } from './encoding';
import { errorMessage } from './errors';
import { isRecord, stringField } from './guards';
import { OPENROUTER_API_BASE } from './providers/openrouter';
import { classifyStatus, send } from './providers/http';
import { AIError } from './types';

export const OPENROUTER_AUTH_URL = 'https://openrouter.ai/auth';
const VERIFIER_BYTES = 32;

export interface PkcePair {
  /** 43 chars of base64url (RFC 7636 section 4.1 allows 43-128). */
  verifier: string;
  /** BASE64URL(SHA256(ASCII(verifier))), method S256. */
  challenge: string;
}

export interface OpenRouterCredentials {
  key: string;
  userId: string | null;
}

export async function pkceChallenge(verifier: string): Promise<string> {
  return bytesToBase64Url(await sha256(verifier));
}

export async function createPkcePair(): Promise<PkcePair> {
  const verifier = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(VERIFIER_BYTES)));
  return { verifier, challenge: await pkceChallenge(verifier) };
}

export interface AuthUrlOptions {
  /** Omit for the headless flow (the code is shown on screen). */
  callbackUrl?: string;
  challenge: string;
  /** Prefills the name of the key created on openrouter.ai. */
  keyLabel: string;
}

export function buildAuthUrl({ callbackUrl, challenge, keyLabel }: AuthUrlOptions): string {
  const url = new URL(OPENROUTER_AUTH_URL);
  if (callbackUrl) url.searchParams.set('callback_url', callbackUrl);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('key_label', keyLabel);
  return url.toString();
}

export interface ExchangeCodeOptions {
  code: string;
  verifier: string;
  signal?: AbortSignal;
}

/** POST /api/v1/auth/keys: trades the one-time code (valid 10 min) for a key. */
export async function exchangeCode({ code, verifier, signal }: ExchangeCodeOptions): Promise<OpenRouterCredentials> {
  const response = await send(
    `${OPENROUTER_API_BASE}/auth/keys`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
    },
    {
      provider: 'openrouter',
      apiKey: '',
      // A rejected code or verifier comes back as 400/403: surface it as auth.
      classify: (info) => (info.status === 400 ? 'auth' : classifyStatus(info.status)),
      signal,
    }
  );
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AIError('bad_response', 'Key exchange returned invalid JSON', 'openrouter');
  }
  const record = isRecord(body) ? body : {};
  const key = stringField(record.key);
  if (!key) throw new AIError('bad_response', 'Key exchange response has no key', 'openrouter');
  return { key, userId: stringField(record.user_id) ?? null };
}

/**
 * Accepts a bare code or anything containing `code=` (a pasted callback URL),
 * trimming whitespace. Returns null when nothing usable is found.
 */
export function parseAuthCode(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const match = /[?&#]code=([^&#\s]+)/.exec(trimmed);
  if (match?.[1]) return decodeURIComponent(match[1]);
  return /^[\w.~-]+$/.test(trimmed) ? trimmed : null;
}

/** The chrome.identity subset used here (injectable for tests). */
export interface IdentityApi {
  getRedirectURL(path?: string): string;
  launchWebAuthFlow(details: { url: string; interactive: boolean }): Promise<string | undefined>;
}

function chromeIdentity(): IdentityApi {
  const identity = typeof chrome === 'undefined' ? undefined : chrome.identity;
  if (!identity) {
    throw new AIError(
      'not_configured',
      'chrome.identity is unavailable (the "identity" permission is required)',
      'openrouter'
    );
  }
  return identity;
}

export interface RedirectFlowOptions {
  keyLabel: string;
  identity?: IdentityApi;
  signal?: AbortSignal;
}

export async function connectWithRedirect({
  keyLabel,
  identity = chromeIdentity(),
  signal,
}: RedirectFlowOptions): Promise<OpenRouterCredentials> {
  const { verifier, challenge } = await createPkcePair();
  const callbackUrl = identity.getRedirectURL('openrouter');
  let responseUrl: string | undefined;
  try {
    responseUrl = await identity.launchWebAuthFlow({
      url: buildAuthUrl({ callbackUrl, challenge, keyLabel }),
      interactive: true,
    });
  } catch (error) {
    // Chrome rejects with "The user did not approve access." when the window is closed.
    const message = errorMessage(error);
    const code = /did not approve|cancel/i.test(message) ? 'cancelled' : 'auth';
    throw new AIError(code, message, 'openrouter');
  }
  const code = responseUrl ? new URL(responseUrl).searchParams.get('code') : null;
  if (!code) throw new AIError('auth', 'OpenRouter did not return an authorization code', 'openrouter');
  return exchangeCode({ code, verifier, signal });
}

export interface HeadlessFlow {
  /** Open this in a tab; openrouter.ai shows a code after the user approves. */
  authUrl: string;
  /** Keep with the flow if the UI must survive a reload (e.g. storage.session). */
  verifier: string;
  /** Exchanges the pasted code (or pasted URL containing it) for a key. */
  complete(pasted: string, signal?: AbortSignal): Promise<OpenRouterCredentials>;
}

export async function createHeadlessFlow(keyLabel: string): Promise<HeadlessFlow> {
  const { verifier, challenge } = await createPkcePair();
  return {
    authUrl: buildAuthUrl({ challenge, keyLabel }),
    verifier,
    async complete(pasted, signal) {
      const code = parseAuthCode(pasted);
      if (!code) throw new AIError('auth', 'That does not look like an OpenRouter code', 'openrouter');
      return exchangeCode({ code, verifier, signal });
    },
  };
}
