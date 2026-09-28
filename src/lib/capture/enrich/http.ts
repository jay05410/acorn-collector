/**
 * Network helpers for background enrichment. Requests never carry cookies
 * (the point is the logged-out, original copy of a post) and are bounded by a
 * timeout so a slow host cannot hold up the capture.
 */

export type FetchFn = typeof fetch;

export interface EnrichDeps {
  fetch: FetchFn;
  /** Per-request timeout in ms. */
  timeoutMs?: number;
}

export const DEFAULT_ENRICH_TIMEOUT_MS = 4000;

async function request(
  url: string,
  deps: EnrichDeps,
  accept: string
): Promise<Response | null> {
  try {
    const response = await deps.fetch(url, {
      credentials: 'omit',
      headers: { Accept: accept },
      signal: AbortSignal.timeout(deps.timeoutMs ?? DEFAULT_ENRICH_TIMEOUT_MS),
    });
    return response.ok ? response : null;
  } catch {
    return null;
  }
}

/** Parsed JSON body, or null on network error, non-2xx status or bad JSON. */
export async function fetchJson(url: string, deps: EnrichDeps): Promise<unknown> {
  const response = await request(url, deps, 'application/json');
  if (!response) return null;
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

/** Response text, or null on network error or non-2xx status. */
export async function fetchText(url: string, deps: EnrichDeps): Promise<string | null> {
  const response = await request(url, deps, 'text/html');
  if (!response) return null;
  try {
    return await response.text();
  } catch {
    return null;
  }
}

export function stringOr(value: unknown, fallback: string | null = null): string | null {
  return typeof value === 'string' && value.trim() ? value : fallback;
}
