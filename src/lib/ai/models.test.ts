import { describe, expect, it } from 'vitest';
import {
  anthropicTuning,
  defaultModelFor,
  imageLimitsFor,
  MODEL_TABLE,
  openAITuning,
  openRouterTuning,
  SELECTABLE_MODELS,
} from './models';

// The only test allowed to spell model IDs: it pins the table itself.
describe('MODEL_TABLE', () => {
  it('matches ADR-001 defaults', () => {
    expect(MODEL_TABLE).toEqual({
      openai: { fast: 'gpt-6-luna', accurate: 'gpt-6-sol' },
      anthropic: { fast: 'claude-sonnet-5', accurate: 'claude-opus-5-5' },
      openrouter: { fast: 'openai/gpt-6-luna', accurate: 'anthropic/claude-sonnet-5' },
    });
    expect(defaultModelFor('anthropic', 'accurate')).toBe('claude-opus-5-5');
  });

  it('lists every default first in the selectable models, without Gemini', () => {
    for (const provider of ['openai', 'anthropic', 'openrouter'] as const) {
      const options = SELECTABLE_MODELS[provider];
      expect(options.slice(0, 2)).toEqual([MODEL_TABLE[provider].fast, MODEL_TABLE[provider].accurate]);
      expect(new Set(options).size).toBe(options.length);
      expect(options.join(' ')).not.toMatch(/gemini/i);
    }
    expect(SELECTABLE_MODELS.openrouter).toEqual(
      expect.arrayContaining([
        'qwen/qwen3.6-35b-a3b',
        'qwen/qwen3.7-plus',
        'mistralai/mistral-small-2603',
        'anthropic/claude-opus-5.5',
        'openai/gpt-6-sol',
      ])
    );
  });
});

describe('imageLimitsFor', () => {
  it('uses the Claude high-res tier and 2048 elsewhere', () => {
    expect(imageLimitsFor('claude-sonnet-5')).toEqual({ maxEdge: 2576, maxPixels: 3_750_000 });
    expect(imageLimitsFor('anthropic/claude-opus-5.5').maxEdge).toBe(2576);
    expect(imageLimitsFor('gpt-6-luna')).toEqual({ maxEdge: 2048 });
    expect(imageLimitsFor('some/unknown-model')).toEqual({ maxEdge: 2048 });
  });
});

describe('openAITuning', () => {
  it('disables reasoning on the fast path and uses low for Sol accurate', () => {
    expect(openAITuning('gpt-6-luna', 'fast')).toEqual({ effort: 'none', maxOutputTokens: 8192 });
    expect(openAITuning('gpt-6-sol', 'fast').effort).toBe('none');
    expect(openAITuning('gpt-6-sol', 'accurate')).toEqual({ effort: 'low', maxOutputTokens: 16000 });
  });

  it('leaves unknown models on their own default', () => {
    expect(openAITuning('gpt-6-astra', 'fast')).toEqual({ maxOutputTokens: 16000 });
  });
});

describe('anthropicTuning', () => {
  it('disables thinking on Sonnet 5 and uses effort low on Opus 5.5', () => {
    expect(anthropicTuning('claude-sonnet-5')).toEqual({ disableThinking: true, maxTokens: 8192 });
    expect(anthropicTuning('claude-opus-5-5')).toEqual({
      disableThinking: false,
      effort: 'low',
      maxTokens: 16000,
    });
    expect(anthropicTuning('claude-haiku-4-5')).toEqual({ disableThinking: false, maxTokens: 16000 });
  });
});

describe('openRouterTuning', () => {
  it('maps reasoning controls per catalog capability', () => {
    expect(openRouterTuning('openai/gpt-6-luna', 'fast')).toEqual({
      reasoning: { effort: 'none' },
      schemaStyle: 'type-array',
      maxTokens: 8192,
    });
    expect(openRouterTuning('openai/gpt-6-sol', 'accurate').reasoning).toEqual({ effort: 'low' });
    expect(openRouterTuning('anthropic/claude-sonnet-5', 'accurate')).toEqual({
      reasoning: { enabled: false },
      schemaStyle: 'any-of',
      maxTokens: 8192,
    });
    expect(openRouterTuning('anthropic/claude-opus-5.5', 'fast')).toEqual({
      reasoning: { effort: 'low' },
      schemaStyle: 'any-of',
      maxTokens: 16000,
    });
    expect(openRouterTuning('qwen/qwen3.7-plus', 'fast').reasoning).toEqual({ enabled: false });
  });

  it('omits reasoning where the default is already off or unknown', () => {
    expect(openRouterTuning('mistralai/mistral-small-2603', 'fast')).toEqual({
      schemaStyle: 'type-array',
      maxTokens: 16000,
    });
  });
});
