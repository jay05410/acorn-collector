/**
 * chrome.storage.local access: settings v2 (see settings-types.ts). Captures
 * reach the side panel through the session handoff (lib/capture/client.ts).
 */
import { detectLanguage, type AppLanguage } from '@/i18n/languages';
import { isAppLanguage } from '@/i18n/state';
import type { ModelTier, ProviderId } from '@/lib/ai/types';
import {
  DEFAULT_AI_SETTINGS,
  type AISettings,
  type ApiKeyProviderSettings,
  type AppSettings,
  type CliBridgeSettings,
  type ColorTheme,
  type OpenRouterSettings,
  type SortBy,
} from '@/lib/settings-types';

const SETTINGS_KEY = 'settings';

const COLOR_THEMES: readonly ColorTheme[] = [
  'acorn',
  'pink',
  'sky',
  'lavender',
];
const SORT_OPTIONS: readonly SortBy[] = ['boothNumber', 'createdAt', 'custom'];
const PROVIDERS: readonly ProviderId[] = [
  'openai',
  'anthropic',
  'openrouter',
  'cli',
];
const TIERS: readonly ModelTier[] = ['fast', 'accurate'];
const CLI_TARGETS: readonly CliBridgeSettings['target'][] = ['claude', 'codex'];
const OPENROUTER_CONNECTIONS: readonly NonNullable<
  OpenRouterSettings['connectedVia']
>[] = ['oauth', 'manual'];

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function oneOf<T>(options: readonly T[], value: unknown, fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function nullableOneOf<T>(
  options: readonly T[],
  value: unknown,
  fallback: T | null
): T | null {
  return value === null ? null : oneOf<T | null>(options, value, fallback);
}

function nullableString(
  value: unknown,
  fallback: string | null
): string | null {
  return value === null || typeof value === 'string' ? value : fallback;
}

function browserLanguage(): AppLanguage {
  return detectLanguage(
    typeof navigator === 'undefined' ? undefined : navigator.language
  );
}

function migrateLanguage(value: unknown): AppLanguage {
  if (value === 'zh') return 'zh-CN';
  return isAppLanguage(value) ? value : browserLanguage();
}

function migrateApiKeyProvider(
  value: unknown,
  defaults: ApiKeyProviderSettings
): ApiKeyProviderSettings {
  const raw = asRecord(value);
  return {
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : defaults.apiKey,
    model: nullableString(raw.model, defaults.model),
  };
}

function migrateAi(value: unknown): AISettings {
  const raw = asRecord(value);
  const defaults = DEFAULT_AI_SETTINGS;
  const openrouter = asRecord(raw.openrouter);
  const cli = asRecord(raw.cli);
  return {
    provider: nullableOneOf(PROVIDERS, raw.provider, defaults.provider),
    tier: oneOf(TIERS, raw.tier, defaults.tier),
    autoAnalyze:
      typeof raw.autoAnalyze === 'boolean'
        ? raw.autoAnalyze
        : defaults.autoAnalyze,
    openai: migrateApiKeyProvider(raw.openai, defaults.openai),
    anthropic: migrateApiKeyProvider(raw.anthropic, defaults.anthropic),
    openrouter: {
      ...migrateApiKeyProvider(openrouter, defaults.openrouter),
      connectedVia: nullableOneOf(
        OPENROUTER_CONNECTIONS,
        openrouter.connectedVia,
        defaults.openrouter.connectedVia
      ),
    },
    cli: {
      target: oneOf(CLI_TARGETS, cli.target, defaults.cli.target),
      model: nullableString(cli.model, defaults.cli.model),
    },
  };
}

/**
 * Pure v1 -> v2 migration and validation. Accepts anything read from storage
 * and always returns complete, valid settings: v1 `aiEnabled` and
 * `geminiApiKey` are dropped, 'zh' becomes 'zh-CN', a missing or unknown
 * language is detected from the browser, invalid fields get defaults.
 */
export function migrateSettings(raw: unknown): AppSettings {
  const value = asRecord(raw);
  const noticeAcceptedAt = value.noticeAcceptedAt;
  return {
    schemaVersion: 2,
    colorTheme: oneOf(COLOR_THEMES, value.colorTheme, 'acorn'),
    language: migrateLanguage(value.language),
    defaultSortBy: oneOf(SORT_OPTIONS, value.defaultSortBy, 'createdAt'),
    ai: migrateAi(value.ai),
    noticeAcceptedAt:
      typeof noticeAcceptedAt === 'number' && Number.isFinite(noticeAcceptedAt)
        ? noticeAcceptedAt
        : null,
  };
}

export function createDefaultSettings(): AppSettings {
  return migrateSettings(undefined);
}

export interface AISettingsPatch extends Partial<
  Pick<AISettings, 'provider' | 'tier' | 'autoAnalyze'>
> {
  openai?: Partial<ApiKeyProviderSettings>;
  anthropic?: Partial<ApiKeyProviderSettings>;
  openrouter?: Partial<OpenRouterSettings>;
  cli?: Partial<CliBridgeSettings>;
}

export interface SettingsPatch extends Partial<
  Pick<
    AppSettings,
    'colorTheme' | 'language' | 'defaultSortBy' | 'noticeAcceptedAt'
  >
> {
  ai?: AISettingsPatch;
}

/** Deep-merges `ai` and each provider sub-object, then re-validates. */
export function applySettingsPatch(
  current: AppSettings,
  patch: SettingsPatch
): AppSettings {
  const { ai, ...rest } = patch;
  const mergedAi: AISettings = ai
    ? {
        ...current.ai,
        ...ai,
        openai: { ...current.ai.openai, ...ai.openai },
        anthropic: { ...current.ai.anthropic, ...ai.anthropic },
        openrouter: { ...current.ai.openrouter, ...ai.openrouter },
        cli: { ...current.ai.cli, ...ai.cli },
      }
    : current.ai;
  return migrateSettings({ ...current, ...rest, ai: mergedAi });
}

/** Stored settings written before schema v2 (no schemaVersion field). */
function isLegacySettings(raw: unknown): boolean {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as UnknownRecord).schemaVersion === undefined
  );
}

async function readStoredSettings(): Promise<unknown> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return stored[SETTINGS_KEY];
}

let writeQueue: Promise<unknown> = Promise.resolve();

/**
 * Runs every settings write one after another, so no read-modify-write can
 * overwrite another's result. A failed job does not stop later ones.
 */
function enqueueWrite<T>(job: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(job);
  writeQueue = result.catch(() => undefined);
  return result;
}

/**
 * Persists the v1 -> v2 migration so v1 secrets (the old Gemini key) leave
 * storage. Queued with updateSettings() and re-checked when it runs: if
 * another write stored v2 settings meanwhile, those are kept and returned.
 */
function persistLegacyMigration(): Promise<AppSettings> {
  return enqueueWrite(async () => {
    const raw = await readStoredSettings();
    const settings = migrateSettings(raw);
    if (isLegacySettings(raw)) {
      await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    }
    return settings;
  });
}

export async function getSettings(): Promise<AppSettings> {
  const raw = await readStoredSettings();
  return isLegacySettings(raw)
    ? persistLegacyMigration()
    : migrateSettings(raw);
}

/**
 * Applies a partial update. Calls are serialized so rapid updates (e.g.
 * typing an API key) never overwrite each other's read-modify-write.
 */
export function updateSettings(patch: SettingsPatch): Promise<AppSettings> {
  return enqueueWrite(async () => {
    const current = migrateSettings(await readStoredSettings());
    const next = applySettingsPatch(current, patch);
    await chrome.storage.local.set({ [SETTINGS_KEY]: next });
    return next;
  });
}

export function watchSettings(
  callback: (settings: AppSettings) => void
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    const change = changes[SETTINGS_KEY];
    if (areaName === 'local' && change) {
      callback(migrateSettings(change.newValue));
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
