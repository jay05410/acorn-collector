import { describe, expect, it } from 'vitest';
import { abortedError, errorMessage, toAIError } from './errors';
import { AIError } from './types';

function abortedSignal(reason?: unknown): AbortSignal {
  const controller = new AbortController();
  controller.abort(reason);
  return controller.signal;
}

describe('abortedError', () => {
  it('distinguishes timeouts from cancellation by the abort reason', () => {
    expect(abortedError(abortedSignal(new DOMException('t', 'TimeoutError')), 'openai')).toMatchObject({
      code: 'timeout',
      provider: 'openai',
    });
    expect(abortedError(abortedSignal())).toMatchObject({ code: 'cancelled' });
  });
});

describe('toAIError', () => {
  it('passes AIError through unchanged', () => {
    const original = new AIError('quota', 'no credits', 'openrouter', 402);
    expect(toAIError(original, 'openai')).toBe(original);
  });

  it('prefers the signal state over the thrown value', () => {
    const signal = abortedSignal(new DOMException('t', 'TimeoutError'));
    expect(toAIError(new DOMException('aborted', 'AbortError'), 'anthropic', signal).code).toBe('timeout');
  });

  it('maps bare abort and timeout errors', () => {
    expect(toAIError(new DOMException('x', 'AbortError')).code).toBe('cancelled');
    expect(toAIError(new DOMException('x', 'TimeoutError')).code).toBe('timeout');
  });

  it('maps fetch TypeErrors to network and everything else to unknown', () => {
    expect(toAIError(new TypeError('Failed to fetch'), 'openai')).toMatchObject({
      code: 'network',
      provider: 'openai',
      message: 'Failed to fetch',
    });
    expect(toAIError(new RangeError('boom')).code).toBe('unknown');
    expect(toAIError('weird').message).toBe('weird');
  });
});

describe('errorMessage', () => {
  it('reads Error messages and falls back for other values', () => {
    expect(errorMessage(new Error('x'))).toBe('x');
    expect(errorMessage({})).toBe('Unknown error');
  });
});
