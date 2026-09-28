// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SettingsBackend } from '@/components/settings/settings-controller';
import { useSettings } from '@/components/settings/useSettings';
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

/** App's part: one settings state, passed to the notice. */
function Harness({
  backend,
  onConnectAi,
}: {
  backend: SettingsBackend;
  onConnectAi: () => void;
}) {
  const { settings, update } = useSettings(backend);
  return (
    <FirstRunNotice
      settings={settings}
      update={update}
      onConnectAi={onConnectAi}
      now={() => NOW}
    />
  );
}

async function renderNotice(noticeAcceptedAt: number | null, onConnectAi = vi.fn()) {
  const backend = memoryBackend({ ...createDefaultSettings(), noticeAcceptedAt });
  render(<Harness backend={backend} onConnectAi={onConnectAi} />);
  await settle();
  return { backend, onConnectAi };
}

function autoSwitch(): HTMLButtonElement {
  const control = byRole('switch')[0];
  if (!(control instanceof HTMLButtonElement)) throw new Error('No switch');
  return control;
}

beforeEach(() => setLanguage('en'));
afterEach(cleanup);

describe('FirstRunNotice', () => {
  it('explains data, AI and ads on first run', async () => {
    await renderNotice(null);
    const dialog = byRole('dialog')[0];
    expect(dialog?.textContent).toContain('Welcome to Acorn Collector');
    expect(dialog?.textContent).toContain('Everything stays in this browser');
    expect(dialog?.textContent).toContain('Sent only to the AI you connect');
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

  it('says that captures are analyzed automatically, and lets the user turn it off', async () => {
    const { backend } = await renderNotice(null);
    const dialog = byRole('dialog')[0];
    expect(dialog?.textContent).toContain('right after a capture while automatic analysis is on');
    // On by default, and the notice says so.
    expect(autoSwitch().getAttribute('aria-checked')).toBe('true');
    expect(dialog?.textContent).toContain('On: a captured post is sent for analysis right away.');

    act(() => autoSwitch().click());
    expect(autoSwitch().getAttribute('aria-checked')).toBe('false');
    expect(dialog?.textContent).toContain('Off: nothing is sent until you tap Analyze.');
    await settle();
    expect(backend.save).toHaveBeenCalledWith({ ai: { autoAnalyze: false } });
    // Changing it does not dismiss the notice.
    expect(byRole('dialog')).toHaveLength(1);
  });

  it('stays hidden once accepted', async () => {
    await renderNotice(NOW - 1000);
    expect(byRole('dialog')).toHaveLength(0);
  });
});
