/** Connection test for the API-key providers (see connection.tsx for the UI). */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toAIError } from '@/lib/ai/errors';
import type { AIErrorCode } from '@/lib/ai/types';
import type { ApiProviderId } from '@/lib/ai/models';
import { getProvider } from '@/lib/ai/providers';
import { connectionErrorMessage, providerName } from './providers';

/** A test that has not answered by then is reported as a timeout. */
export const CONNECTION_TEST_TIMEOUT_MS = 20_000;

export type ConnectionTestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok' }
  | { status: 'error'; message: string; code: AIErrorCode };

type Tester = (apiKey: string, signal: AbortSignal) => Promise<unknown>;

/**
 * Runs a provider's cheap credential check. A newer run or reset() cancels
 * the one in flight; unmounting cancels too.
 */
export function useConnectionTest(
  provider: ApiProviderId,
  tester?: Tester
): {
  state: ConnectionTestState;
  run: (apiKey: string) => Promise<void>;
  reset: () => void;
} {
  const [state, setState] = useState<ConnectionTestState>({ status: 'idle' });
  const current = useRef<AbortController | null>(null);

  useEffect(() => () => current.current?.abort(), []);

  const run = useCallback(
    async (apiKey: string) => {
      current.current?.abort();
      const controller = new AbortController();
      current.current = controller;
      const timer = setTimeout(
        () =>
          controller.abort(new DOMException('Test timed out', 'TimeoutError')),
        CONNECTION_TEST_TIMEOUT_MS
      );
      setState({ status: 'testing' });
      const test: Tester =
        tester ??
        ((key, signal) =>
          getProvider(provider).testConnection({
            apiKey: key,
            model: '',
            signal,
          }));
      try {
        await test(apiKey, controller.signal);
        if (current.current === controller) setState({ status: 'ok' });
      } catch (error) {
        if (current.current !== controller) return;
        const aiError = toAIError(error, provider, controller.signal);
        const message = connectionErrorMessage(aiError, providerName(provider));
        setState(
          message
            ? { status: 'error', message, code: aiError.code }
            : { status: 'idle' }
        );
      } finally {
        clearTimeout(timer);
      }
    },
    [provider, tester]
  );

  const reset = useCallback(() => {
    current.current?.abort();
    current.current = null;
    setState({ status: 'idle' });
  }, []);

  return { state, run, reset };
}
