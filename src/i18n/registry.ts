/**
 * Message catalogs by language. Each language lives in ./locales/<lang>/
 * (one file per namespace plus an index); English defines the keys.
 */
import type { LocaleMessages } from './define';
import type { AppLanguage } from './languages';
import en from './locales/en';
import ja from './locales/ja';
import ko from './locales/ko';
import zhCN from './locales/zh-CN';
import zhTW from './locales/zh-TW';

export const englishMessages = en;

export const catalogs: Record<AppLanguage, LocaleMessages> = {
  ko,
  en,
  ja,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
};
