import { afterEach, describe, expect, it } from 'vitest';
import { setLanguage } from '@/i18n';
import { BRIDGE_MESSAGES } from '@/lib/bridge/errors';
import { bridgeError, fromHostError } from '@/lib/bridge/errors';
import {
  describeAIError,
  ERROR_ENTRIES,
  errorActionLabel,
  errorKind,
} from './error-messages';
import { AIError, type AIErrorCode } from './types';

const CODES: AIErrorCode[] = [
  'not_configured',
  'auth',
  'rate_limit',
  'quota',
  'network',
  'timeout',
  'cancelled',
  'bad_response',
  'refused',
  'unavailable',
  'unknown',
];

afterEach(() => setLanguage('en'));

describe('errorKind', () => {
  it('uses AIError.code for API providers', () => {
    for (const code of CODES) {
      expect(errorKind(new AIError(code, 'x', 'openai'))).toBe(code);
    }
  });

  it('prefers the bridge message code for the CLI provider', () => {
    expect(errorKind(bridgeError('not_configured', 'bridge_not_installed'))).toBe(
      'bridge_not_installed'
    );
    expect(
      errorKind(fromHostError({ code: 'not_logged_in', message: 'x' }))
    ).toBe('cli_not_logged_in');
    expect(
      errorKind(fromHostError({ code: 'origin_not_allowed', message: 'x' }))
    ).toBe('bridge_forbidden');
  });

  it('ignores bridge-looking messages from other providers', () => {
    expect(errorKind(new AIError('auth', 'bridge_busy', 'openai'))).toBe('auth');
  });

  it('treats non-AIError values as unknown', () => {
    expect(errorKind(new Error('boom'))).toBe('unknown');
    expect(errorKind('boom')).toBe('unknown');
    expect(errorKind(undefined)).toBe('unknown');
  });
});

describe('describeAIError', () => {
  it('covers every AIError code and bridge message', () => {
    for (const kind of [...CODES, ...BRIDGE_MESSAGES, 'origin_not_allowed']) {
      expect(ERROR_ENTRIES).toHaveProperty(kind);
    }
  });

  it('sends configuration problems to Settings', () => {
    expect(describeAIError(new AIError('auth', 'x', 'openai')).action).toBe(
      'open-settings'
    );
    expect(describeAIError(new AIError('not_configured', 'x')).action).toBe(
      'open-settings'
    );
    expect(
      describeAIError(bridgeError('not_configured', 'bridge_not_installed'))
        .action
    ).toBe('open-settings');
  });

  it('offers accurate mode when the answer was unusable', () => {
    expect(
      describeAIError(new AIError('bad_response', 'x', 'openai')).action
    ).toBe('retry-accurate');
  });

  it('offers a plain retry for transient failures', () => {
    for (const code of ['rate_limit', 'network', 'timeout', 'unavailable'] as const) {
      expect(describeAIError(new AIError(code, 'x', 'anthropic')).action).toBe(
        'retry'
      );
    }
  });

  it('has no action where retrying cannot help', () => {
    expect(
      describeAIError(bridgeError('unknown', 'bridge_bad_request')).action
    ).toBe('none');
  });

  it('localizes and never leaks the raw message', () => {
    const error = new AIError('auth', 'Incorrect API key sk-secret', 'openai');
    const en = describeAIError(error);
    expect(en.title).toBe('API key not accepted');
    expect(`${en.title} ${en.body}`).not.toContain('sk-secret');
    setLanguage('ko');
    expect(describeAIError(error).title).toBe('API 키가 거부됐어요');
    expect(errorActionLabel('open-settings')).toBe('설정 열기');
  });

  it('resolves every entry to real messages', () => {
    for (const kind of Object.keys(ERROR_ENTRIES)) {
      const { title, body } = ERROR_ENTRIES[kind as keyof typeof ERROR_ENTRIES];
      expect(title).toMatch(/Title$/);
      expect(body).toMatch(/Body$/);
    }
    const all = describeAIError(bridgeError('unavailable', 'bridge_disconnected'));
    expect(all.title).not.toMatch(/Title$/);
    expect(all.body).not.toMatch(/Body$/);
  });
});
