import { describe, expect, it } from 'vitest';
import { CORE_LANGUAGES } from '@/i18n/languages';
import { isLanguageAvailable, pickerLanguages } from './languages';

const tables = {
  one: {
    en: { a: 'A', b: 'B' },
    ko: { a: 'a', b: 'b' },
    th: { a: 'a', b: 'b' },
    fr: { a: 'a' },
  },
  two: {
    en: { c: 'C' },
    ko: { c: 'c' },
    th: { c: 'c' },
    fr: { c: 'c' },
    de: { c: '  ' },
  },
};

describe('isLanguageAvailable', () => {
  it('requires every key of every namespace', () => {
    expect(isLanguageAvailable('ko', tables)).toBe(true);
    expect(isLanguageAvailable('th', tables)).toBe(true);
    expect(isLanguageAvailable('fr', tables)).toBe(false);
    expect(isLanguageAvailable('de', tables)).toBe(false);
    expect(isLanguageAvailable('ja', tables)).toBe(false);
  });

  it('offers the five core languages with the real messages', () => {
    for (const language of CORE_LANGUAGES) {
      expect(isLanguageAvailable(language)).toBe(true);
    }
  });
});

describe('pickerLanguages', () => {
  it('lists complete languages in app order', () => {
    // English defines the keys, so it is always complete.
    expect(pickerLanguages('ko', tables)).toEqual(['ko', 'en', 'th']);
  });

  it('keeps the current language even when it is incomplete', () => {
    expect(pickerLanguages('fr', tables)).toEqual(['ko', 'en', 'th', 'fr']);
  });

  it('shows at least the core languages today', () => {
    expect(pickerLanguages('en')).toEqual(expect.arrayContaining([...CORE_LANGUAGES]));
  });
});
