/**
 * i18n entry point: `import { t, tp, useLanguage, formatPrice } from '@/i18n'`.
 * Strings live in ./messages/<namespace>.ts; missing keys fall back to English.
 */
import { useSyncExternalStore } from 'react';
import { PRESET_BADGE_IDS } from '@/constants/presetBadges';
import {
  ITEM_CATEGORIES,
  type Badge,
  type ItemCategory,
  type PresetBadgeId,
} from '@/types';
import { formatNumber } from './format';
import { FALLBACK_LANGUAGE, type AppLanguage } from './languages';
import { namespaces } from './registry';
import { getLanguage, subscribeLanguage } from './state';

export {
  formatDate,
  formatNumber,
  formatPrice,
  normalizeCurrencyCode,
  parseIsoDate,
  toIsoDate,
} from './format';
export {
  getLanguage,
  getLanguageInfo,
  isAppLanguage,
  setLanguage,
  subscribeLanguage,
} from './state';

type Namespaces = typeof namespaces;
export type Namespace = keyof Namespaces;
export type MessageKey<N extends Namespace> = Extract<
  keyof Namespaces[N]['en'],
  string
>;
export type MessageParams = Record<string, string | number>;

type LooseTable = Partial<Record<AppLanguage, Partial<Record<string, string>>>>;

function lookup(namespace: Namespace, key: string): string {
  const table: LooseTable = namespaces[namespace];
  return table[getLanguage()]?.[key] || table[FALLBACK_LANGUAGE]?.[key] || key;
}

export function t<N extends Namespace>(
  namespace: N,
  key: MessageKey<N>
): string {
  return lookup(namespace, key);
}

/** Like t(), replacing `{name}` placeholders. Numbers use locale grouping. */
export function tp<N extends Namespace>(
  namespace: N,
  key: MessageKey<N>,
  params: MessageParams
): string {
  return lookup(namespace, key).replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined) return match;
    return typeof value === 'number' ? formatNumber(value) : value;
  });
}

/** Current language; re-renders the calling component when it changes. */
export function useLanguage(): AppLanguage {
  return useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
}

const CATEGORY_SET: ReadonlySet<string> = new Set(ITEM_CATEGORIES);
const PRESET_BADGE_SET: ReadonlySet<string> = new Set(PRESET_BADGE_IDS);

function isItemCategory(value: string): value is ItemCategory {
  return CATEGORY_SET.has(value);
}

function isPresetBadgeId(value: string): value is PresetBadgeId {
  return PRESET_BADGE_SET.has(value);
}

/** Localized label for a known category; unknown values are shown as-is. */
export function getCategoryLabel(category: string): string {
  return isItemCategory(category) ? t('categories', category) : category;
}

/** Preset badges are localized by id; custom badges keep the user's label. */
export function getBadgeLabel(
  badge: Pick<Badge, 'id' | 'label' | 'isPreset'>
): string {
  return badge.isPreset && isPresetBadgeId(badge.id)
    ? t('badges', badge.id)
    : badge.label;
}
