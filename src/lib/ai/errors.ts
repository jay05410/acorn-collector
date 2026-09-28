/** Normalization of thrown values into AIError (AI layer contract: always AIError). */
import { AIError, type ProviderId } from './types';

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Unknown error';
}

function isTimeoutReason(reason: unknown): boolean {
  return (reason as { name?: unknown } | null | undefined)?.name === 'TimeoutError';
}

/** Error for an aborted signal: 'timeout' when aborted by a TimeoutError reason. */
export function abortedError(signal: AbortSignal, provider?: ProviderId): AIError {
  return isTimeoutReason(signal.reason)
    ? new AIError('timeout', 'The request timed out', provider)
    : new AIError('cancelled', 'The request was cancelled', provider);
}

/**
 * Maps anything thrown by fetch/stream reads to an AIError. The abort reason
 * is read from the signal, not the error, because runtimes differ in what
 * they reject with.
 */
export function toAIError(error: unknown, provider?: ProviderId, signal?: AbortSignal): AIError {
  if (error instanceof AIError) return error;
  if (signal?.aborted) return abortedError(signal, provider);
  if (isTimeoutReason(error)) return new AIError('timeout', 'The request timed out', provider);
  if ((error as { name?: unknown } | null)?.name === 'AbortError') {
    return new AIError('cancelled', 'The request was cancelled', provider);
  }
  // fetch() rejects with TypeError for DNS/TLS/CORS/offline failures.
  if (error instanceof TypeError) return new AIError('network', error.message, provider);
  return new AIError('unknown', errorMessage(error), provider);
}
