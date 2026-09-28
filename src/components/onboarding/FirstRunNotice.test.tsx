// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SettingsBackend } from '@/components/settings/settings-controller';
import { byRole, byText, cleanup, render } from '@/components/ui/test-utils';
import { setLanguage } from '@/i18n';
import {
  applySettingsPatch,
  createDefaultSettings,
  type SettingsPatch,
} from '@/lib/storage';
import type { AppSettings } from '@/lib/settings-types';
import { FirstRunNotice } from './FirstRunNotice';

const NOW = Date.UTC(2026, 8, 29, 9);

function memoryBackend(initial: AppSettings) {
  let stored = initial;
  const listeners = new Set<(settings: AppSettings) => void>();
  const backend: SettingsBackend = {
    load: vi.fn(async () => stored),
    save: vi.fn(async (patch: SettingsPatch) => {
      stored = applySettingsPatch(stored, patch);
      for (const listener of listeners) listener(stored);
      return stored;
    }),
    watch: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return backend;
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderNotice(noticeAcceptedAt: number | null, onConnectAi = vi.fn()) {
  const backend = memoryBackend({ ...createDefaultSettings(), noticeAcceptedAt });
  render(<FirstRunNotice backend={backend} onConnectAi={onConnectAi} now={() => NOW} />);
  await settle();
  return { backend, onConnectAi };
}

beforeEach(() => setLanguage('en'));
afterEach(cleanup);

describe('FirstRunNotice', () => {
  it('explains data, AI and ads on first run', async () => {
    await renderNotice(null);
    const dialog = byRole('dialog')[0];
    expect(dialog?.textContent).toContain('Welcome to Acorn Collector');
    expect(dialog?.textContent).toContain('Everything stays in this browser');
    expect(dialog?.textContent).toContain('AI only when you ask');
    expect(dialog?.textContent).toContain('Non-personalized ads');
    expect(document.activeElement?.textContent).toBe('Get started');
  });

  it('is accepted with Get started', async () => {
    const { backend } = await renderNotice(null);
    act(() => byText('Get started').click());
    await settle();
    expect(backend.save).toHaveBeenCalledWith({ noticeAcceptedAt: NOW });
    expect(byRole('dialog')).toHaveLength(0);
  });

  it('accepts and opens the AI settings with Connect AI now', async () => {
    const { backend, onConnectAi } = await renderNotice(null);
    act(() => byText('Connect AI now').click());
    await settle();
    expect(backend.save).toHaveBeenCalledWith({ noticeAcceptedAt: NOW });
    expect(onConnectAi).toHaveBeenCalledOnce();
  });

  it('stays hidden once accepted', async () => {
    await renderNotice(NOW - 1000);
    expect(byRole('dialog')).toHaveLength(0);
  });
});
