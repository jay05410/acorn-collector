import {
  LANGUAGE_INFO,
  detectLanguage,
  isAppLanguage,
  type AppLanguage,
  type LanguageInfo,
} from './languages';

export { isAppLanguage };

type Listener = () => void;

const listeners = new Set<Listener>();

let current: AppLanguage = detectLanguage(
  typeof navigator === 'undefined' ? undefined : navigator.language
);

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
