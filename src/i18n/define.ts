/**
 * Message typing. English (locales/en) is the source of truth: its keys are
 * the only valid keys, and every other locale must match them exactly.
 */
import type en from './locales/en';

/** One namespace of one language: key -> message. */
export type MessageTable = Record<string, string>;

type English = typeof en;

type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many';
type PluralBase<K> = K extends `${infer Base}_other` ? Base : never;

/**
 * A namespace in a non-English locale: exactly English's keys, all strings,
 * plus optional plural forms English does not need (e.g. `boothCount_few`
 * for a language whose Intl.PluralRules use "few"). Used with `satisfies`
 * on an object literal, a missing or unknown key is a compile error.
 */
export type NamespaceMessages<T> = { [K in keyof T]: string } & {
  [K in `${PluralBase<keyof T>}_${PluralCategory}`]?: string;
};

/** Everything one locale provides (locales/<lang>/index.ts). */
export type LocaleMessages = {
  [N in keyof English]: NamespaceMessages<English[N]>;
};
