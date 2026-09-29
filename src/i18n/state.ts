/**
 * The current UI language. Kept free of message tables so modules that only
 * format numbers and dates (and the background worker) stay small; the
 * message catalog (./catalog) plugs in the loader setLanguage() waits for.
 */
import {
  LANGUAGE_INFO,
  detectLanguage,
  isAppLanguage,
  type AppLanguage,
  type LanguageInfo,
} from './languages';

export { isAppLanguage };

type Listener = () => void;

interface LanguageLoader {
  isLoaded(language: AppLanguage): boolean;
  load(language: AppLanguage): Promise<void>;
}

const listeners = new Set<Listener>();
let loader: LanguageLoader | null = null;

let current: AppLanguage = detectLanguage(
  typeof navigator === 'undefined' ? undefined : navigator.language
);
/** The language of the latest setLanguage() call: the one that wins. */
let requested: AppLanguage = current;

export function getLanguage(): AppLanguage {
  return current;
}

/** Called once by ./catalog so setLanguage() can load messages first. */
export function registerLanguageLoader(next: LanguageLoader): void {
  loader = next;
}

function apply(language: AppLanguage): void {
  if (language === current) return;
  current = language;
  for (const listener of [...listeners]) listener();
}

/**
 * Switches the UI language and notifies subscribers once its messages are
 * loaded, so the UI never shows a half-loaded language. Switches at once
 * (before returning) when they are already cached. When several calls
 * overlap, the latest one wins. If loading fails the language is still
 * applied and strings fall back to English per key. Never rejects; unknown
 * codes are ignored.
 */
export function setLanguage(language: AppLanguage): Promise<void> {
  if (!isAppLanguage(language)) return Promise.resolve();
  requested = language;
  if (!loader || loader.isLoaded(language)) {
    apply(language);
    return Promise.resolve();
  }
  return loader.load(language).then(
    () => {
      if (requested === language) apply(language);
    },
    (error: unknown) => {
      console.error(
        `[i18n] could not load the ${language} messages; showing English`,
        error
      );
      if (requested === language) apply(language);
    }
  );
}

export function subscribeLanguage(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLanguageInfo(): LanguageInfo {
  return LANGUAGE_INFO[current];
}
