import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AI_SETTINGS, type AppSettings } from './settings-types';
import {
  applySettingsPatch,
  createDefaultSettings,
  getSettings,
  migrateSettings,
  updateSettings,
  watchSettings,
} from './storage';

type ChangeListener = (
  changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
  areaName: string
) => void;

function installChromeStorage(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = structuredClone(initial);
  const listeners = new Set<ChangeListener>();
  const local = {
    get: vi.fn(async (key: string) =>
      key in data ? { [key]: structuredClone(data[key]) } : {}
    ),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(items)) {
        const oldValue = data[key];
        data[key] = structuredClone(value);
        listeners.forEach((l) =>
          l({ [key]: { oldValue, newValue: value } }, 'local')
        );
      }
    }),
  };
  vi.stubGlobal('chrome', {
    storage: {
      local,
      onChanged: {
        addListener: (l: ChangeListener) => listeners.add(l),
        removeListener: (l: ChangeListener) => listeners.delete(l),
      },
    },
  });
  return { data, local, listeners };
}

const v1Settings = {
  colorTheme: 'pink',
  defaultSortBy: 'boothNumber',
  aiEnabled: true,
  geminiApiKey: 'AIza-secret',
  language: 'zh',
};

beforeEach(() => {
  vi.stubGlobal('navigator', { language: 'ja-JP' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('migrateSettings', () => {
  it('migrates v1 settings and drops the Gemini fields', () => {
    const migrated = migrateSettings(v1Settings);

    expect(migrated).toEqual({
      schemaVersion: 2,
      colorTheme: 'pink',
      language: 'zh-CN',
      defaultSortBy: 'boothNumber',
      ai: DEFAULT_AI_SETTINGS,
      noticeAcceptedAt: null,
    });
    expect(migrated).not.toHaveProperty('aiEnabled');
    expect(migrated).not.toHaveProperty('geminiApiKey');
  });

  it('keeps supported v1 languages', () => {
    expect(migrateSettings({ language: 'ko' }).language).toBe('ko');
    expect(migrateSettings({ language: 'en' }).language).toBe('en');
  });

  it('detects the language from the browser when missing or unknown', () => {
    expect(migrateSettings({}).language).toBe('ja');
    expect(migrateSettings({ language: 'klingon' }).language).toBe('ja');
    vi.stubGlobal('navigator', { language: 'zh-Hant-TW' });
    expect(migrateSettings(undefined).language).toBe('zh-TW');
  });

  it('returns defaults for non-object input', () => {
    for (const raw of [undefined, null, 'settings', 42, ['ko']]) {
      expect(migrateSettings(raw)).toEqual(createDefaultSettings());
    }
    expect(createDefaultSettings()).toMatchObject({
      schemaVersion: 2,
      colorTheme: 'acorn',
      defaultSortBy: 'createdAt',
      language: 'ja',
      noticeAcceptedAt: null,
    });
  });

  it('replaces invalid values with defaults', () => {
    const migrated = migrateSettings({
      colorTheme: 'neon',
      defaultSortBy: 'price',
      noticeAcceptedAt: 'yesterday',
      ai: {
        provider: 'gemini',
        tier: 'turbo',
        autoAnalyze: 'yes',
        openai: { apiKey: 7, model: 3 },
        openrouter: { connectedVia: 'magic' },
        cli: { target: 'gemini-cli' },
      },
    });

    expect(migrated.colorTheme).toBe('acorn');
    expect(migrated.defaultSortBy).toBe('createdAt');
    expect(migrated.noticeAcceptedAt).toBeNull();
    expect(migrated.ai).toEqual(DEFAULT_AI_SETTINGS);
  });

  it('fills missing AI sub-fields and keeps valid ones', () => {
    const migrated = migrateSettings({
      schemaVersion: 2,
      ai: {
        provider: 'openrouter',
        openrouter: { apiKey: 'sk-or', connectedVia: 'oauth' },
        cli: { target: 'codex' },
      },
    });

    expect(migrated.ai).toEqual({
      ...DEFAULT_AI_SETTINGS,
      provider: 'openrouter',
      openrouter: { apiKey: 'sk-or', model: null, connectedVia: 'oauth' },
      cli: { target: 'codex', model: null },
    });
  });

  it('is idempotent for v2 settings', () => {
    const v2: AppSettings = {
      schemaVersion: 2,
      colorTheme: 'sky',
      language: 'zh-TW',
      defaultSortBy: 'custom',
      noticeAcceptedAt: 1_790_000_000_000,
      ai: {
        ...DEFAULT_AI_SETTINGS,
        provider: 'anthropic',
        tier: 'accurate',
        autoAnalyze: false,
        anthropic: { apiKey: 'sk-ant', model: 'claude-sonnet-5' },
      },
    };
    expect(migrateSettings(v2)).toEqual(v2);
    expect(migrateSettings(migrateSettings(v1Settings))).toEqual(
      migrateSettings(v1Settings)
    );
  });

  it('never shares nested objects with the defaults', () => {
    const settings = createDefaultSettings();
    settings.ai.openai.apiKey = 'mutated';
    expect(DEFAULT_AI_SETTINGS.openai.apiKey).toBe('');
  });
});

describe('applySettingsPatch', () => {
  it('deep-merges ai and provider sub-objects', () => {
    const current = migrateSettings({
      ai: {
        provider: 'openai',
        openai: { apiKey: 'sk-1', model: 'gpt-6-sol' },
      },
    });

    const next = applySettingsPatch(current, {
      colorTheme: 'lavender',
      ai: {
        tier: 'accurate',
        openai: { apiKey: 'sk-2' },
        cli: { model: 'opus' },
      },
    });

    expect(next.colorTheme).toBe('lavender');
    expect(next.ai.provider).toBe('openai');
    expect(next.ai.tier).toBe('accurate');
    expect(next.ai.openai).toEqual({ apiKey: 'sk-2', model: 'gpt-6-sol' });
    expect(next.ai.cli).toEqual({ target: 'claude', model: 'opus' });
    expect(next.ai.anthropic).toEqual(current.ai.anthropic);
  });

  it('can clear the provider', () => {
    const current = migrateSettings({ ai: { provider: 'cli' } });
    expect(
      applySettingsPatch(current, { ai: { provider: null } }).ai.provider
    ).toBeNull();
  });
});

describe('settings storage', () => {
  it('persists the migration of v1 settings once', async () => {
    const { data, local } = installChromeStorage({ settings: v1Settings });

    const settings = await getSettings();
    expect(settings.language).toBe('zh-CN');
    expect(data.settings).toEqual(settings);
    expect(JSON.stringify(data)).not.toContain('AIza-secret');

    await getSettings();
    expect(local.set).toHaveBeenCalledTimes(1);
  });

  it('never lets a slow legacy read overwrite a queued update', async () => {
    const { data, local } = installChromeStorage({ settings: v1Settings });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Startup read: storage is read now (v1), the answer arrives later.
    local.get.mockImplementationOnce(async (key: string) => {
      const snapshot = { [key]: structuredClone(data[key]) };
      await gate;
      return snapshot;
    });

    const startup = getSettings();
    const updated = await updateSettings({ colorTheme: 'sky' });
    release();
    const settings = await startup;

    expect(updated.colorTheme).toBe('sky');
    expect(data.settings).toMatchObject({
      schemaVersion: 2,
      colorTheme: 'sky',
      language: 'zh-CN',
    });
    expect(settings).toEqual(data.settings);
    expect(JSON.stringify(data)).not.toContain('AIza-secret');
  });

  it('migrates once when several readers find v1 settings', async () => {
    const { data, local } = installChromeStorage({ settings: v1Settings });

    const [first, second] = await Promise.all([getSettings(), getSettings()]);

    expect(first).toEqual(second);
    expect(data.settings).toEqual(first);
    expect(local.set).toHaveBeenCalledTimes(1);
  });

  it('returns defaults without writing on a fresh install', async () => {
    const { local } = installChromeStorage();
    expect(await getSettings()).toEqual(createDefaultSettings());
    expect(local.set).not.toHaveBeenCalled();
  });

  it('serializes concurrent updates', async () => {
    const { data } = installChromeStorage();

    await Promise.all([
      updateSettings({ ai: { openai: { apiKey: 'sk-a' } } }),
      updateSettings({ ai: { openai: { model: 'gpt-6-luna' } } }),
      updateSettings({ colorTheme: 'sky' }),
    ]);

    const stored = data.settings as AppSettings;
    expect(stored.colorTheme).toBe('sky');
    expect(stored.ai.openai).toEqual({ apiKey: 'sk-a', model: 'gpt-6-luna' });
  });

  it('keeps working after a failed write', async () => {
    const { local } = installChromeStorage();
    local.set.mockRejectedValueOnce(new Error('QUOTA_BYTES exceeded'));

    await expect(updateSettings({ colorTheme: 'pink' })).rejects.toThrow(
      'QUOTA'
    );
    await expect(updateSettings({ colorTheme: 'sky' })).resolves.toMatchObject({
      colorTheme: 'sky',
    });
  });

  it('notifies watchers with migrated settings', async () => {
    const { listeners } = installChromeStorage();
    const callback = vi.fn();
    const unwatch = watchSettings(callback);

    await updateSettings({ language: 'ko' });
    expect(callback).toHaveBeenLastCalledWith(
      expect.objectContaining({ language: 'ko', schemaVersion: 2 })
    );

    unwatch();
    expect(listeners.size).toBe(0);
  });
});
