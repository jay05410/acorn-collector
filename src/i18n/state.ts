import {
  APP_LANGUAGES,
  LANGUAGE_INFO,
  detectLanguage,
  type AppLanguage,
  type LanguageInfo,
} from './languages';

type Listener = () => void;

const listeners = new Set<Listener>();

let current: AppLanguage = detectLanguage(
  typeof navigator === 'undefined' ? undefined : navigator.language
);

export function isAppLanguage(value: unknown): value is AppLanguage {
  return (
    typeof value === 'string' &&
    (APP_LANGUAGES as readonly string[]).includes(value)
  );
}

export function getLanguage(): AppLanguage {
  return current;
}

/** Switches the UI language and notifies subscribers. Unknown codes are ignored. */
export function setLanguage(language: AppLanguage): void {
  if (!isAppLanguage(language) || language === current) return;
  current = language;
  for (const listener of [...listeners]) listener();
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
