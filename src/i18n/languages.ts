/**
 * Language registry (contract, owner decision 2026-09-29): the languages the
 * app ships, and everything the app needs to know about each one. Adding a
 * language is data-driven from here; see docs/v2/I18N.md.
 *
 * This file is read by the Node tooling in scripts/i18n (without a
 * TypeScript compiler), so keep the tables plain literals: string values,
 * no computed keys, no spreads.
 */

/** Languages offered in the app. Each one must be complete (`pnpm i18n:check`). */
export const APP_LANGUAGES = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number];

/** Source of truth for message keys; bundled eagerly and used per key when a string is missing. */
export const FALLBACK_LANGUAGE = 'en' satisfies AppLanguage;

export interface LanguageInfo<Code extends string = AppLanguage> {
  code: Code;
  /** Name in its own language, for the language picker. */
  nativeName: string;
  /** English name, used in AI prompts ("translate names into ..."). */
  englishName: string;
  /** BCP 47 tag for Intl.* formatting and plural rules. */
  intlLocale: string;
  /** Folder name under public/_locales (Chrome locale code). */
  chromeLocale: string;
  /** Currency most users of this language see at local events (ISO 4217). */
  defaultCurrency: string;
  /** Locale id under `react-day-picker/locale/` for the calendar. */
  dayPickerLocale: string;
}

export const LANGUAGE_INFO = {
  ko: {
    code: 'ko',
    nativeName: '한국어',
    englishName: 'Korean',
    intlLocale: 'ko-KR',
    chromeLocale: 'ko',
    defaultCurrency: 'KRW',
    dayPickerLocale: 'ko',
  },
  en: {
    code: 'en',
    nativeName: 'English',
    englishName: 'English',
    intlLocale: 'en-US',
    chromeLocale: 'en',
    defaultCurrency: 'USD',
    dayPickerLocale: 'en-US',
  },
  ja: {
    code: 'ja',
    nativeName: '日本語',
    englishName: 'Japanese',
    intlLocale: 'ja-JP',
    chromeLocale: 'ja',
    defaultCurrency: 'JPY',
    dayPickerLocale: 'ja',
  },
  'zh-CN': {
    code: 'zh-CN',
    nativeName: '简体中文',
    englishName: 'Simplified Chinese',
    intlLocale: 'zh-CN',
    chromeLocale: 'zh_CN',
    defaultCurrency: 'CNY',
    dayPickerLocale: 'zh-CN',
  },
  'zh-TW': {
    code: 'zh-TW',
    nativeName: '繁體中文',
    englishName: 'Traditional Chinese',
    intlLocale: 'zh-TW',
    chromeLocale: 'zh_TW',
    defaultCurrency: 'TWD',
    dayPickerLocale: 'zh-TW',
  },
} as const satisfies { [L in AppLanguage]: LanguageInfo<L> };

/** Calendar locale ids in use; DatePicker must have a loader for each. */
export type DayPickerLocaleId =
  (typeof LANGUAGE_INFO)[AppLanguage]['dayPickerLocale'];

/**
 * Languages being translated, added by `pnpm i18n:new <lang>`. A draft is not
 * offered, detected or loaded: to ship it, move its entry to LANGUAGE_INFO and
 * its code to APP_LANGUAGES once `pnpm i18n:check` passes (docs/v2/I18N.md).
 */
export const DRAFT_LANGUAGE_INFO: Readonly<
  Record<string, LanguageInfo<string>>
> = {};

export function isAppLanguage(value: unknown): value is AppLanguage {
  return (
    typeof value === 'string' &&
    (APP_LANGUAGES as readonly string[]).includes(value)
  );
}

const TRADITIONAL_CHINESE_REGIONS: ReadonlySet<string> = new Set([
  'tw',
  'hk',
  'mo',
]);

function detectChinese(subtags: readonly string[]): AppLanguage {
  if (subtags.includes('hant')) return 'zh-TW';
  if (subtags.includes('hans')) return 'zh-CN';
  return subtags.some((subtag) => TRADITIONAL_CHINESE_REGIONS.has(subtag))
    ? 'zh-TW'
    : 'zh-CN';
}

/**
 * Maps a browser language tag (navigator.language) to an app language: an
 * exact match first (case-insensitive), then Chinese by script or region
 * (Hant, TW, HK, MO -> zh-TW; others -> zh-CN), then the base language.
 * Anything else falls back to English.
 */
export function detectLanguage(tag: string | undefined | null): AppLanguage {
  if (!tag) return FALLBACK_LANGUAGE;
  const lower = tag.trim().replace(/_/g, '-').toLowerCase();
  const exact = APP_LANGUAGES.find((code) => code.toLowerCase() === lower);
  if (exact) return exact;
  const [base = '', ...subtags] = lower.split('-');
  if (base === 'zh') return detectChinese(subtags);
  return isAppLanguage(base) ? base : FALLBACK_LANGUAGE;
}
