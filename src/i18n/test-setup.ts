/**
 * Vitest setup: loads every app language up front, so tests can call
 * setLanguage() and read strings right away (it switches synchronously when
 * the messages are cached). Lazy loading itself is covered by
 * lazy-loading.test.ts with a mocked loader.
 */
import { ensureLanguageLoaded } from '@/i18n';
import { APP_LANGUAGES } from '@/i18n/languages';

await Promise.all(
  APP_LANGUAGES.map((language) => ensureLanguageLoaded(language))
);
