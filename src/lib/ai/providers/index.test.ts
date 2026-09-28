import { describe, expect, it } from 'vitest';
import type { AIProvider } from '../types';
import { getProvider, registerProvider } from './index';

describe('provider registry', () => {
  it('has the API-key providers built in', () => {
    expect(getProvider('openai').id).toBe('openai');
    expect(getProvider('anthropic').id).toBe('anthropic');
    expect(getProvider('openrouter').id).toBe('openrouter');
  });

  it('reports an unregistered CLI bridge as not configured, then accepts registration', () => {
    expect(() => getProvider('cli')).toThrowError(
      expect.objectContaining({ name: 'AIError', code: 'not_configured', provider: 'cli' })
    );
    const cli: AIProvider = {
      id: 'cli',
      defaultModel: () => 'sonnet',
      extract: async () => {
        throw new Error('not used');
      },
      testConnection: async () => undefined,
    };
    registerProvider(cli);
    expect(getProvider('cli')).toBe(cli);
  });
});
