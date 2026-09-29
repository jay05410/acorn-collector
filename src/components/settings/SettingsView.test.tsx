// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { byText, cleanup, click, press, render } from '@/components/ui/test-utils';
import { clearToasts, getToasts } from '@/components/ui/toast-store';
import { setLanguage } from '@/i18n';
import { APP_LANGUAGES, LANGUAGE_INFO } from '@/i18n/languages';
import type { HeadlessFlow, OpenRouterCredentials } from '@/lib/ai/openrouter-oauth';
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
import { useSettings } from './useSettings';

const EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';

/** Per-test replacements for the OpenRouter sign-in helpers (else the real ones). */
const oauth = vi.hoisted(() => ({
  createHeadlessFlow: null as null | ((keyLabel: string) => Promise<HeadlessFlow>),
  connectWithRedirect: null as null | (() => Promise<OpenRouterCredentials>),
}));

vi.mock('@/lib/ai/openrouter-oauth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/openrouter-oauth')>();
  return {
    ...actual,
    createHeadlessFlow: (keyLabel: string) =>
      (oauth.createHeadlessFlow ?? actual.createHeadlessFlow)(keyLabel),
    connectWithRedirect: (options: Parameters<typeof actual.connectWithRedirect>[0]) =>
      oauth.connectWithRedirect
        ? oauth.connectWithRedirect()
        : actual.connectWithRedirect(options),
  };
});

function memoryBackend(initial: AppSettings, { failSaves = false } = {}) {
  let stored = initial;
  let failing = failSaves;
  const listeners = new Set<(settings: AppSettings) => void>();
  const backend: SettingsBackend = {
    load: vi.fn(async () => stored),
    save: vi.fn(async (patch: SettingsPatch) => {
      if (failing) throw new Error('storage unavailable');
      stored = applySettingsPatch(stored, patch);
      for (const listener of listeners) listener(stored);
      return stored;
    }),
    watch: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    backend,
    get stored() {
      return stored;
    },
    setFailSaves(value: boolean) {
      failing = value;
    },
    /** A change written by another extension page. */
    external(patch: SettingsPatch) {
      stored = applySettingsPatch(stored, patch);
      for (const listener of listeners) listener(stored);
    },
  };
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

/** App's part: one settings state, passed to the view. */
function Harness({
  backend,
  onBack,
  deps,
}: {
  backend: SettingsBackend;
  onBack: () => void;
  deps: CliCheckDeps;
}) {
  const { settings, update } = useSettings(backend);
  return (
    <SettingsView settings={settings} update={update} onBack={onBack} cliDeps={deps} />
  );
}

async function renderView(
  initial: AppSettings,
  options: { failSaves?: boolean; deps?: CliCheckDeps; onBack?: () => void } = {}
) {
  const store = memoryBackend(initial, { failSaves: options.failSaves });
  render(
    <Harness
      backend={store.backend}
      onBack={options.onBack ?? (() => {})}
      deps={options.deps ?? cliDeps()}
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
  oauth.createHeadlessFlow = null;
  oauth.connectWithRedirect = null;
});

function pendingFlow() {
  return {
    authUrl: 'https://openrouter.ai/auth?code_challenge=x&code_challenge_method=S256',
    verifier: 'v'.repeat(43),
    createdAt: Date.now(),
  };
}

async function submit(input: HTMLInputElement | null) {
  await act(async () => {
    input?.form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await settle();
}

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

  it('offers every app language by its own name and saves a pick', async () => {
    const store = await renderView(settings());
    const options = [
      ...document.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ].filter((input) => input.closest('fieldset')?.textContent?.includes('Language'));
    expect(options.map((input) => input.value)).toEqual([...APP_LANGUAGES]);
    expect(options.map((input) => input.closest('label')?.textContent)).toEqual(
      APP_LANGUAGES.map((code) => LANGUAGE_INFO[code].nativeName)
    );
    expect(options.find((input) => input.checked)?.value).toBe('en');
    act(() => radio(LANGUAGE_INFO.ja.nativeName).click());
    await settle();
    expect(store.stored.language).toBe('ja');
  });

  it('goes back on Escape, but not while typing in a field', async () => {
    const onBack = vi.fn();
    await renderView(settings({ ai: { provider: 'openai' } }), { onBack });
    const input = document.querySelector<HTMLInputElement>('input[type="password"]');
    press(input, 'Escape');
    expect(onBack).not.toHaveBeenCalled();
    press(document.querySelector('h1'), 'Escape');
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('goes back on Escape from radio options, which hold no typed text', async () => {
    const onBack = vi.fn();
    await renderView(settings({ ai: { provider: 'openai' } }), { onBack });
    press(radio('OpenAI'), 'Escape');
    expect(onBack).toHaveBeenCalledTimes(1);
    press(radio('Lavender'), 'Escape');
    expect(onBack).toHaveBeenCalledTimes(2);
    press(document.querySelector('[role="switch"]'), 'Escape');
    expect(onBack).toHaveBeenCalledTimes(3);
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

  it('keeps the model field in step with the stored model', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = await renderView(
      settings({ ai: { provider: 'openai', openai: { apiKey: 'sk-1', model: 'my-model' } } }),
      { failSaves: true }
    );
    const modelSelect = () => {
      const select = [...document.querySelectorAll('select')].find((el) =>
        el.textContent?.includes('Custom model ID')
      );
      if (!select) throw new Error('no model select');
      return select;
    };
    const customInput = () =>
      [...document.querySelectorAll('input')].find((input) => input.value === 'my-model');
    expect(modelSelect().value).toBe('__custom__');
    expect(customInput()).toBeDefined();

    // Another page picks a listed model: the field follows.
    act(() => store.external({ ai: { openai: { model: 'gpt-6-sol' } } }));
    expect(modelSelect().value).toBe('gpt-6-sol');
    expect(customInput()).toBeUndefined();

    // A custom ID that cannot be saved is rolled back, in the field too.
    act(() => {
      const select = modelSelect();
      select.value = '__custom__';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const draft = [...document.querySelectorAll('input')].find(
      (input) => input.value === 'gpt-6-sol'
    );
    typeInto(draft!, 'other-model');
    await act(async () => draft!.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    await settle();
    expect(store.backend.save).toHaveBeenCalledWith({
      ai: { openai: { model: 'other-model' } },
    });
    expect(store.stored.ai.openai.model).toBe('gpt-6-sol');
    expect(modelSelect().value).toBe('gpt-6-sol');
    expect([...document.querySelectorAll('input')].some((i) => i.value === 'other-model')).toBe(false);
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

  it('keeps an issued OpenRouter key whose save failed, and saves it on retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith('/auth/keys')
        ? new Response('{"key":"sk-or-issued"}', { status: 200 })
        : new Response('{"data":{}}', { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);
    session.set(HEADLESS_FLOW_KEY, pendingFlow());
    const store = await renderView(settings({ ai: { provider: 'openrouter' } }), {
      failSaves: true,
    });
    const code = [...document.querySelectorAll('input')].find(
      (input) => input.closest('form') !== null && input.type !== 'password'
    );
    typeInto(code!, 'code-123');
    await submit(code!);

    const exchanges = () =>
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/keys')).length;
    expect(exchanges()).toBe(1);
    expect(text()).toContain("OpenRouter created your key, but it couldn't be saved");
    expect(store.stored.ai.openrouter.apiKey).toBe('');
    // The used-up code flow is not offered again.
    expect(session.has(HEADLESS_FLOW_KEY)).toBe(false);
    expect(text()).not.toContain('Code from OpenRouter');

    store.setFailSaves(false);
    await act(async () => button('Retry save').click());
    await settle();
    expect(store.stored.ai.openrouter).toMatchObject({
      apiKey: 'sk-or-issued',
      connectedVia: 'oauth',
    });
    expect(exchanges()).toBe(1);
    expect(text()).toContain('Connected through OpenRouter sign-in');
  });

  it('clears a pending OpenRouter code flow however the key is connected', async () => {
    oauth.connectWithRedirect = async () => ({ key: 'sk-or-signin', userId: null });
    const store = await renderView(settings({ ai: { provider: 'openrouter' } }));
    session.set(HEADLESS_FLOW_KEY, pendingFlow());
    await act(async () => button('Connect with OpenRouter').click());
    await settle();
    expect(store.stored.ai.openrouter.apiKey).toBe('sk-or-signin');
    expect(session.has(HEADLESS_FLOW_KEY)).toBe(false);

    cleanup();
    const pasted = await renderView(settings({ ai: { provider: 'openrouter' } }));
    act(() => button('Paste an existing key').click());
    session.set(HEADLESS_FLOW_KEY, pendingFlow());
    const key = document.querySelector<HTMLInputElement>('input[type="password"]');
    typeInto(key!, 'sk-or-pasted');
    await submit(key);
    expect(pasted.stored.ai.openrouter.apiKey).toBe('sk-or-pasted');
    expect(session.has(HEADLESS_FLOW_KEY)).toBe(false);
  });

  it('reports a code flow that cannot start', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    oauth.createHeadlessFlow = async () => {
      throw new Error('crypto.subtle unavailable');
    };
    await renderView(settings({ ai: { provider: 'openrouter' } }));
    await act(async () => button('Use a code instead').click());
    await settle();
    expect(text()).toContain("Couldn't start connecting with a code");
    expect(session.has(HEADLESS_FLOW_KEY)).toBe(false);

    oauth.createHeadlessFlow = null;
    await act(async () => button('Retry').click());
    await settle();
    expect(text()).not.toContain("Couldn't start connecting with a code");
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

  it('checks the CLI helper once when the permission is granted', async () => {
    const deps = cliDeps();
    await renderView(settings({ ai: { provider: 'cli' } }), { deps });
    expect(deps.status).not.toHaveBeenCalled();
    await act(async () => button('Allow').click());
    await settle();
    expect(deps.requestPermission).toHaveBeenCalledOnce();
    expect(deps.status).toHaveBeenCalledOnce();
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
