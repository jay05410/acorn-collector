/**
 * Settings v2 contract (ACORN-3). Stored in chrome.storage.local under
 * "settings" (never storage.sync: API keys must stay on this device).
 * v1 fields `aiEnabled` and `geminiApiKey` are dropped on migration; Gemini is
 * no longer supported. v1 language 'zh' migrates to 'zh-CN'.
 */
import type { AppLanguage } from '@/i18n/languages';
import type { ModelTier, ProviderId } from '@/lib/ai/types';

export type ColorTheme = 'acorn' | 'pink' | 'sky' | 'lavender';
export type SortBy = 'boothNumber' | 'createdAt' | 'custom';

export interface ApiKeyProviderSettings {
  apiKey: string;
  /** null = use the bundled default for the selected tier (see ai/models.ts). */
  model: string | null;
}

export interface OpenRouterSettings extends ApiKeyProviderSettings {
  connectedVia: 'oauth' | 'manual' | null;
}

export interface CliBridgeSettings {
  target: 'claude' | 'codex';
  model: string | null;
}

export interface AISettings {
  /** Active provider; null until the user connects one. */
  provider: ProviderId | null;
  tier: ModelTier;
  /** Start AI extraction automatically after a capture. */
  autoAnalyze: boolean;
  openai: ApiKeyProviderSettings;
  anthropic: ApiKeyProviderSettings;
  openrouter: OpenRouterSettings;
  cli: CliBridgeSettings;
}

export interface AppSettings {
  schemaVersion: 2;
  colorTheme: ColorTheme;
  language: AppLanguage;
  defaultSortBy: SortBy;
  ai: AISettings;
  /** Timestamp the user accepted the first-run data/ads notice. */
  noticeAcceptedAt: number | null;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: null,
  tier: 'fast',
  autoAnalyze: true,
  openai: { apiKey: '', model: null },
  anthropic: { apiKey: '', model: null },
  openrouter: { apiKey: '', model: null, connectedVia: null },
  cli: { target: 'claude', model: null },
};
