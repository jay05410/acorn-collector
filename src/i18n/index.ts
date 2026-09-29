/**
 * i18n entry point:
 * `import { t, tp, tn, useLanguage, formatPrice } from '@/i18n'`.
 * Strings live in ./locales/<lang>/<namespace>.ts (docs/v2/I18N.md); a
 * missing string falls back to English per key.
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
import {
  FALLBACK_LANGUAGE,
  LANGUAGE_INFO,
  type AppLanguage,
} from './languages';
import { catalogs, englishMessages } from './registry';
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

type Namespaces = typeof englishMessages;
export type Namespace = keyof Namespaces;
export type MessageKey<N extends Namespace> = Extract<
  keyof Namespaces[N],
  string
>;
export type MessageParams = Record<string, string | number>;

type PluralBase<K extends string> = K extends `${infer Base}_other`
  ? Base
  : never;
/** Base keys of namespace N that have an `<base>_other` plural form. */
export type PluralKey<N extends Namespace> = PluralBase<MessageKey<N>>;

type LooseTable = Partial<Record<string, string>>;

/** One namespace of a language, or undefined while it is not loaded. */
function messages(
  language: AppLanguage,
  namespace: Namespace
): LooseTable | undefined {
  return catalogs[language]?.[namespace];
}

function lookup(namespace: Namespace, key: string): string {
  return (
    messages(getLanguage(), namespace)?.[key] ||
    messages(FALLBACK_LANGUAGE, namespace)?.[key] ||
    key
  );
}

export function t<N extends Namespace>(
  namespace: N,
  key: MessageKey<N>
): string {
  return lookup(namespace, key);
}

function interpolate(message: string, params: MessageParams): string {
  return message.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined) return match;
    return typeof value === 'number' ? formatNumber(value) : value;
  });
}

/** Like t(), replacing `{name}` placeholders. Numbers use locale grouping. */
export function tp<N extends Namespace>(
  namespace: N,
  key: MessageKey<N>,
  params: MessageParams
): string {
  return interpolate(lookup(namespace, key), params);
}

const pluralRules = new Map<string, Intl.PluralRules>();

function pluralCategory(language: AppLanguage, count: number): string {
  const locale = LANGUAGE_INFO[language].intlLocale;
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRules.set(locale, rules);
  }
  return rules.select(count);
}

/**
 * `<base>_<category>` in the current language, else its `<base>_other`.
 * When the language lacks both, English is used with English plural rules.
 */
function lookupPlural(
  namespace: Namespace,
  baseKey: string,
  count: number
): string {
  const pick = (language: AppLanguage): string | undefined => {
    const table = messages(language, namespace);
    const category = pluralCategory(language, count);
    return table?.[`${baseKey}_${category}`] || table?.[`${baseKey}_other`];
  };
  return pick(getLanguage()) || pick(FALLBACK_LANGUAGE) || `${baseKey}_other`;
}

/**
 * Count-dependent message: picks `<baseKey>_<Intl plural category>` (e.g.
 * `boothCount_one`), falling back to `<baseKey>_other`, then fills `{count}`
 * and `params` like tp(). Only keys with an `_other` form are accepted.
 */
export function tn<N extends Namespace>(
  namespace: N,
  baseKey: PluralKey<N>,
  count: number,
  params: MessageParams = {}
): string {
  return interpolate(lookupPlural(namespace, baseKey, count), {
    ...params,
    count,
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
