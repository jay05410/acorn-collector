import type { AppLanguage } from './languages';

export type MessageTable = Record<string, string>;

/**
 * One namespace in every language. `en` defines the key set; every other
 * app language must match it exactly.
 */
export type NamespaceMessages<T extends MessageTable> = { en: T } & Record<
  Exclude<AppLanguage, 'en'>,
  NoInfer<T>
>;

export function defineMessages<T extends MessageTable>(
  messages: NamespaceMessages<T>
): NamespaceMessages<T> {
  return messages;
}
