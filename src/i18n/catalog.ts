/**
 * Loaded messages by language. English is always here; other languages are
 * loaded once, on demand, and cached. Importing this module lets
 * setLanguage() load a language before switching to it.
 */
import type { LocaleMessages } from './define';
import { FALLBACK_LANGUAGE, type AppLanguage } from './languages';
import { englishMessages, localeLoaders } from './registry';
import { registerLanguageLoader } from './state';

export { englishMessages };

const loaded = new Map<AppLanguage, LocaleMessages>([
  [FALLBACK_LANGUAGE, englishMessages],
]);
const pending = new Map<AppLanguage, Promise<void>>();

/** Messages of a language, or undefined until it is loaded. */
export function getCatalog(language: AppLanguage): LocaleMessages | undefined {
  return loaded.get(language);
}

export function isLanguageLoaded(language: AppLanguage): boolean {
  return loaded.has(language);
}

/**
 * Loads a language's messages once (concurrent calls share one request). A
 * failed load is not cached, so the next call tries again.
 */
export function ensureLanguageLoaded(language: AppLanguage): Promise<void> {
  if (loaded.has(language)) return Promise.resolve();
  let request = pending.get(language);
  if (!request) {
    const load = localeLoaders[language];
    request = (
      load
        ? load()
        : Promise.reject(new Error(`No messages for language "${language}"`))
    )
      .then((messages) => {
        loaded.set(language, messages);
      })
      .finally(() => {
        pending.delete(language);
      });
    pending.set(language, request);
  }
  return request;
}

registerLanguageLoader({
  isLoaded: isLanguageLoaded,
  load: ensureLanguageLoaded,
});
