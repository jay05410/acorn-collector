/**
 * Supported UI languages. The first five are "core" (every namespace must be
 * complete in them); the rest are added in ACORN-9 and fall back to English
 * until their namespaces are complete.
 */
export const APP_LANGUAGES = [
  'ko',
  'en',
  'ja',
  'zh-CN',
  'zh-TW',
  'th',
  'id',
  'vi',
  'es',
  'fr',
  'de',
  'pt-BR',
] as const;

export type AppLanguage = (typeof APP_LANGUAGES)[number];

export const CORE_LANGUAGES = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'] as const;

export const FALLBACK_LANGUAGE: AppLanguage = 'en';

export interface LanguageInfo {
  code: AppLanguage;
  /** Name in its own language, for the language picker. */
  nativeName: string;
  /** English name, used in AI prompts ("translate names into ..."). */
  englishName: string;
  /** BCP 47 tag for Intl.* formatting. */
  intlLocale: string;
  /** Folder name under public/_locales (Chrome locale code). */
  chromeLocale: string;
  /** Currency most users of this language see at local events. */
  defaultCurrency: string;
}

export const LANGUAGE_INFO: Record<AppLanguage, LanguageInfo> = {
  ko: { code: 'ko', nativeName: '한국어', englishName: 'Korean', intlLocale: 'ko-KR', chromeLocale: 'ko', defaultCurrency: 'KRW' },
  en: { code: 'en', nativeName: 'English', englishName: 'English', intlLocale: 'en-US', chromeLocale: 'en', defaultCurrency: 'USD' },
  ja: { code: 'ja', nativeName: '日本語', englishName: 'Japanese', intlLocale: 'ja-JP', chromeLocale: 'ja', defaultCurrency: 'JPY' },
  'zh-CN': { code: 'zh-CN', nativeName: '简体中文', englishName: 'Simplified Chinese', intlLocale: 'zh-CN', chromeLocale: 'zh_CN', defaultCurrency: 'CNY' },
  'zh-TW': { code: 'zh-TW', nativeName: '繁體中文', englishName: 'Traditional Chinese', intlLocale: 'zh-TW', chromeLocale: 'zh_TW', defaultCurrency: 'TWD' },
  th: { code: 'th', nativeName: 'ไทย', englishName: 'Thai', intlLocale: 'th-TH', chromeLocale: 'th', defaultCurrency: 'THB' },
  id: { code: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', intlLocale: 'id-ID', chromeLocale: 'id', defaultCurrency: 'IDR' },
  vi: { code: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese', intlLocale: 'vi-VN', chromeLocale: 'vi', defaultCurrency: 'VND' },
  es: { code: 'es', nativeName: 'Español', englishName: 'Spanish', intlLocale: 'es-ES', chromeLocale: 'es', defaultCurrency: 'EUR' },
  fr: { code: 'fr', nativeName: 'Français', englishName: 'French', intlLocale: 'fr-FR', chromeLocale: 'fr', defaultCurrency: 'EUR' },
  de: { code: 'de', nativeName: 'Deutsch', englishName: 'German', intlLocale: 'de-DE', chromeLocale: 'de', defaultCurrency: 'EUR' },
  'pt-BR': { code: 'pt-BR', nativeName: 'Português (Brasil)', englishName: 'Brazilian Portuguese', intlLocale: 'pt-BR', chromeLocale: 'pt_BR', defaultCurrency: 'BRL' },
};

/** Map a browser language tag (navigator.language) to an app language. */
export function detectLanguage(tag: string | undefined | null): AppLanguage {
  if (!tag) return FALLBACK_LANGUAGE;
  const lower = tag.toLowerCase();
  if (lower.startsWith('zh')) {
    return /(tw|hk|mo|hant)/.test(lower) ? 'zh-TW' : 'zh-CN';
  }
  if (lower.startsWith('pt')) return 'pt-BR';
  const base = lower.split('-')[0] as AppLanguage;
  return (APP_LANGUAGES as readonly string[]).includes(base)
    ? base
    : FALLBACK_LANGUAGE;
}
