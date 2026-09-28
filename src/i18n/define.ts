import type { AppLanguage, CORE_LANGUAGES } from './languages';

export type CoreLanguage = (typeof CORE_LANGUAGES)[number];
export type ExtendedLanguage = Exclude<AppLanguage, CoreLanguage>;

export type MessageTable = Record<string, string>;

/**
 * One namespace in every language. `en` defines the key set; the other core
 * languages must match it exactly, extended languages may be partial and fall
 * back to English per key.
 */
export type NamespaceMessages<T extends MessageTable> = { en: T } & Record<
  Exclude<CoreLanguage, 'en'>,
  NoInfer<T>
> &
  Partial<Record<ExtendedLanguage, Partial<NoInfer<T>>>>;

export function defineMessages<T extends MessageTable>(
  messages: NamespaceMessages<T>
): NamespaceMessages<T> {
  return messages;
}
