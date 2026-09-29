import type { DayPickerLocale } from 'react-day-picker';
import type { DayPickerLocaleId } from '@/i18n/languages';

/**
 * Calendar locales keyed by `LANGUAGE_INFO[language].dayPickerLocale`, one
 * small chunk each, loaded on demand. `null` means DayPicker's built-in
 * en-US. Import paths must be literal for the bundler, so a language with a
 * new id needs a line here; the key type makes a missing one a compile error.
 */
export const DAY_PICKER_LOCALES: Record<
  DayPickerLocaleId,
  (() => Promise<DayPickerLocale>) | null
> = {
  'en-US': null,
  ko: () => import('react-day-picker/locale/ko').then((m) => m.ko),
  ja: () => import('react-day-picker/locale/ja').then((m) => m.ja),
  'zh-CN': () => import('react-day-picker/locale/zh-CN').then((m) => m.zhCN),
  'zh-TW': () => import('react-day-picker/locale/zh-TW').then((m) => m.zhTW),
};
