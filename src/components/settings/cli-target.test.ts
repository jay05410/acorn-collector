import { describe, expect, it } from 'vitest';
import { cliTargetChange, isForeignCliModel } from './cli-target';

describe('cliTargetChange', () => {
  it('keeps the default (null) model', () => {
    expect(cliTargetChange({ target: 'claude', model: null }, 'codex')).toEqual({
      patch: { target: 'codex' },
      clearedModel: null,
    });
  });

  it('clears a Claude model when switching to Codex', () => {
    expect(cliTargetChange({ target: 'claude', model: 'opus' }, 'codex')).toEqual({
      patch: { target: 'codex', model: null },
      clearedModel: 'opus',
    });
    expect(
      cliTargetChange({ target: 'claude', model: 'claude-sonnet-5[1m]' }, 'codex')
        .clearedModel
    ).toBe('claude-sonnet-5[1m]');
  });

  it('clears a Codex model when switching to Claude Code', () => {
    expect(cliTargetChange({ target: 'codex', model: 'gpt-6-luna' }, 'claude')).toEqual({
      patch: { target: 'claude', model: null },
      clearedModel: 'gpt-6-luna',
    });
  });

  it('keeps a model the new target accepts', () => {
    expect(cliTargetChange({ target: 'codex', model: 'sonnet' }, 'claude')).toEqual({
      patch: { target: 'claude' },
      clearedModel: null,
    });
  });

  it('treats a blank model as the default', () => {
    expect(cliTargetChange({ target: 'claude', model: '   ' }, 'codex').clearedModel).toBeNull();
  });
});

describe('isForeignCliModel', () => {
  it('flags names the target CLI does not accept', () => {
    expect(isForeignCliModel('codex', 'haiku')).toBe(true);
    expect(isForeignCliModel('claude', 'o4-mini')).toBe(true);
    expect(isForeignCliModel('claude', 'sonnet')).toBe(false);
    expect(isForeignCliModel('codex', 'gpt-6-sol')).toBe(false);
    expect(isForeignCliModel('codex', '')).toBe(false);
  });
});
