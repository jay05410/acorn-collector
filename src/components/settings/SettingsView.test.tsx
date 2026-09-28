// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { byText, cleanup, click, render } from '@/components/ui/test-utils';
import { clearToasts, getToasts } from '@/components/ui/toast-store';
import { setLanguage } from '@/i18n';
import { bridgeError } from '@/lib/bridge/errors';
import {
  applySettingsPatch,
  createDefaultSettings,
  type SettingsPatch,
} from '@/lib/storage';
import type { AppSettings } from '@/lib/settings-types';
import type { CliCheckDeps } from './cli-check';
import { HEADLESS_FLOW_KEY } from './headless-session';
import type { SettingsBackend } from './settings-controller';
import { SettingsView } from './SettingsView';

const EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';

function memoryBackend(initial: AppSettings, { failSaves = false } = {}) {
  let stored = initial;
  const listeners = new Set<(settings: AppSettings) => void>();
  const backend: SettingsBackend = {
    load: vi.fn(async () => stored),
    save: vi.fn(async (patch: SettingsPatch) => {
      if (failSaves) throw new Error('storage unavailable');
      stored = applySettingsPatch(stored, patch);
      for (const listener of listeners) listener(stored);
      return stored;
    }),
    watch: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return { backend, get stored() {
    return stored;
  } };
}

function settings(patch: SettingsPatch = {}): AppSettings {
  return applySettingsPatch(
    { ...createDefaultSettings(), language: 'en', noticeAcceptedAt: null },
    patch
  );
}

const session = new Map<string, unknown>();

function cliDeps(overrides: Partial<CliCheckDeps> = {}): CliCheckDeps {
  return {
    hasPermission: vi.fn(async () => false),
    requestPermission: vi.fn(async () => true),
    status: vi.fn(async () => {
      throw bridgeError('not_configured', 'bridge_not_installed');
    }),
    ...overrides,
  };
}

async function settle() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderView(
  initial: AppSettings,
  options: { failSaves?: boolean; deps?: CliCheckDeps; onBack?: () => void } = {}
) {
  const store = memoryBackend(initial, { failSaves: options.failSaves });
  render(
    <SettingsView
      onBack={options.onBack ?? (() => {})}
      backend={store.backend}
      cliDeps={options.deps ?? cliDeps()}
    />
  );
  await settle();
  return store;
}

function radio(name: string): HTMLInputElement {
  const label = [...document.querySelectorAll('label')].find((el) =>
    el.textContent?.includes(name)
  );
  const input = label?.querySelector<HTMLInputElement>('input[type="radio"]');
  if (!input) throw new Error(`No radio labelled "${name}"`);
  return input;
}

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function button(name: string): HTMLButtonElement {
  const match = [...document.querySelectorAll('button')].find(
    (el) => el.textContent?.trim() === name
  );
  if (!match) throw new Error(`No button "${name}"`);
  return match;
}

function text(): string {
  return document.body.textContent ?? '';
}

beforeEach(() => {
  setLanguage('en');
  session.clear();
  vi.stubGlobal('chrome', {
    runtime: { id: EXTENSION_ID, getManifest: () => ({ version: '1.2.3' }) },
    storage: {
      session: {
        get: vi.fn(async (key: string) => (session.has(key) ? { [key]: session.get(key) } : {})),
        set: vi.fn(async (items: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(items)) session.set(key, value);
        }),
        remove: vi.fn(async (key: string) => {
          session.delete(key);
        }),
      },
    },
    tabs: { create: vi.fn(async () => ({})) },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{"data":[]}', { status: 200 }))
  );
});

afterEach(() => {
  cleanup();
  clearToasts();
  vi.unstubAllGlobals();
});

describe('SettingsView', () => {
  it('shows every section and goes back', async () => {
    const onBack = vi.fn();
    await renderView(settings(), { onBack });
    for (const heading of ['AI connection', 'Analysis', 'Appearance', 'Data', 'About']) {
      expect(byText(heading).tagName).toBe('H2');
    }
    expect(text()).toContain('No AI service is connected');
    expect(text()).toContain('1.2.3');
    click(document.querySelector('button[aria-label="Back"]'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('switches the active provider and saves a key', async () => {
    const store = await renderView(settings());
    act(() => radio('OpenAI').click());
    await settle();
    expect(store.backend.save).toHaveBeenCalledWith({ ai: { provider: 'openai' } });

    const input = document.querySelector<HTMLInputElement>('input[type="password"]');
    if (!input) throw new Error('no key input');
    typeInto(input, '  sk-test-1234  ');
    await act(async () => {
      input.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await settle();
    expect(store.stored.ai.openai.apiKey).toBe('sk-test-1234');
    expect(text()).toContain('Saved key ending in 1234');
    // Saving runs the connection test against the (stubbed) API.
    expect(text()).toContain('Connected. OpenAI accepted the key.');
  });

  it('reports a rejected key from the connection test', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":{"message":"bad key"}}', { status: 401 }))
    );
    await renderView(
      settings({ ai: { provider: 'anthropic', anthropic: { apiKey: 'sk-ant-9999' } } })
    );
    click(button('Test connection'));
    await settle();
    expect(text()).toContain('Connection failed');
    expect(text()).toContain('The key was rejected');
    // The summary and the card badge no longer claim the provider is ready.
    expect(text()).toContain('Anthropic did not accept the saved key');
    expect(text()).toContain('Check key');
    expect(text()).not.toContain('Ready. Analysis uses Anthropic.');
    expect(text()).not.toContain('sk-ant-9999');
  });

  it('rolls back a change that could not be saved', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await renderView(settings(), { failSaves: true });
    act(() => radio('Lavender').click());
    await settle();
    expect(radio('Lavender').checked).toBe(false);
    expect(radio('Acorn').checked).toBe(true);
    expect(getToasts().map((toast) => toast.tone)).toContain('error');
  });

  it('resumes an OpenRouter code flow after a reload', async () => {
    session.set(HEADLESS_FLOW_KEY, {
      authUrl: 'https://openrouter.ai/auth?code_challenge=x&code_challenge_method=S256',
      verifier: 'v'.repeat(43),
      createdAt: Date.now(),
    });
    await renderView(settings({ ai: { provider: 'openrouter' } }));
    expect(text()).toContain('Connect with a code');
    expect(text()).toContain('Code from OpenRouter');
  });

  it('shows OpenRouter credits once connected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: { label: 'Acorn Collector', limit: 10, limit_remaining: 7.5, usage: 2.5, is_free_tier: false },
            }),
            { status: 200 }
          )
      )
    );
    await renderView(
      settings({ ai: { provider: 'openrouter', openrouter: { apiKey: 'sk-or-1', connectedVia: 'oauth' } } })
    );
    expect(text()).toContain('Connected through OpenRouter sign-in');
    expect(text()).toContain('$7.50');
    expect(text()).toContain('Acorn Collector');
  });

  it('walks the CLI steps and reports a missing helper', async () => {
    const deps = cliDeps({ hasPermission: vi.fn(async () => true) });
    await renderView(settings({ ai: { provider: 'cli' } }), { deps });
    expect(deps.status).toHaveBeenCalled();
    expect(text()).toContain(`node install.mjs --extension-id ${EXTENSION_ID}`);
    expect(text()).toContain('Allowed');
    expect(text()).toContain("The helper isn't installed yet");
  });

  it('clears a CLI model the new target cannot use', async () => {
    const store = await renderView(
      settings({ ai: { provider: 'cli', cli: { target: 'claude', model: 'opus' } } })
    );
    act(() => button('Codex').click());
    await settle();
    expect(store.backend.save).toHaveBeenCalledWith({
      ai: { cli: { target: 'codex', model: null } },
    });
    expect(getToasts().some((toast) => toast.message.includes('"opus"'))).toBe(true);
  });
});
