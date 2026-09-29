import { describe, expect, it } from 'vitest';
import {
  APP_LANGUAGES,
  DRAFT_LANGUAGE_INFO,
  FALLBACK_LANGUAGE,
  LANGUAGE_INFO,
  detectLanguage,
  isAppLanguage,
} from './languages';

describe('language registry', () => {
  it('ships Korean, English, Japanese and both Chinese scripts', () => {
    expect([...APP_LANGUAGES]).toEqual(['ko', 'en', 'ja', 'zh-CN', 'zh-TW']);
    expect(FALLBACK_LANGUAGE).toBe('en');
  });

  it.each(APP_LANGUAGES)('describes %s completely', (code) => {
    const info = LANGUAGE_INFO[code];
    expect(info.code).toBe(code);
    for (const field of [
      'nativeName',
      'englishName',
      'intlLocale',
      'chromeLocale',
      'dayPickerLocale',
    ] as const) {
      expect(info[field].trim(), `${code}.${field}`).not.toBe('');
    }
    expect(info.defaultCurrency).toMatch(/^[A-Z]{3}$/);
    expect(Intl.NumberFormat.supportedLocalesOf(info.intlLocale)).toEqual([
      info.intlLocale,
    ]);
    expect(info.chromeLocale).toMatch(/^[a-z]{2,3}(_[A-Z0-9]{2,3})?$/);
  });

  it('keeps LANGUAGE_INFO and APP_LANGUAGES in sync', () => {
    expect(Object.keys(LANGUAGE_INFO).sort()).toEqual(
      [...APP_LANGUAGES].sort()
    );
  });

  it('keeps drafts out of the shipped languages', () => {
    for (const code of Object.keys(DRAFT_LANGUAGE_INFO)) {
      expect(isAppLanguage(code), code).toBe(false);
    }
  });
});

describe('isAppLanguage', () => {
  it('accepts only shipped language codes', () => {
    expect(isAppLanguage('zh-TW')).toBe(true);
    for (const value of ['th', 'fr', 'pt-BR', 'zh', 'EN', '', null, 3]) {
      expect(isAppLanguage(value), String(value)).toBe(false);
    }
  });
});

describe('detectLanguage', () => {
  it.each([
    ['ko-KR', 'ko'],
    ['ko', 'ko'],
    ['en-GB', 'en'],
    ['ja-JP', 'ja'],
    ['zh-CN', 'zh-CN'],
    ['zh', 'zh-CN'],
    ['zh-SG', 'zh-CN'],
    ['zh-Hans-HK', 'zh-CN'],
    ['zh-TW', 'zh-TW'],
    ['zh-HK', 'zh-TW'],
    ['zh-MO', 'zh-TW'],
    ['zh-Hant', 'zh-TW'],
    ['zh-Hant-TW', 'zh-TW'],
    ['zh_TW', 'zh-TW'],
    ['ZH-tw', 'zh-TW'],
  ])('maps %s to %s', (tag, expected) => {
    expect(detectLanguage(tag)).toBe(expected);
  });

  it.each(['th-TH', 'fr', 'pt-BR', 'de-DE', 'x-klingon', ''])(
    'falls back to English for %j',
    (tag) => {
      expect(detectLanguage(tag)).toBe('en');
    }
  );

  it('falls back to English without a tag', () => {
    expect(detectLanguage(undefined)).toBe('en');
    expect(detectLanguage(null)).toBe('en');
  });
});
