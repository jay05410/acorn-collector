import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LocaleMessages } from './define';
import type { AppLanguage } from './languages';
import english from './locales/en';

/**
 * Lazy loading with a mocked loader. Each test gets fresh i18n modules, so
 * nothing is loaded except English (the setup file's preload is not seen).
 */
type Loader = () => Promise<LocaleMessages>;
type I18n = typeof import('./index');

/** Every English string prefixed, e.g. "ja:Save". */
function fakeLocale(prefix: string): LocaleMessages {
  return Object.fromEntries(
    Object.entries(english).map(([namespace, table]) => [
      namespace,
      Object.fromEntries(
        Object.entries(table).map(([key, value]) => [key, `${prefix}:${value}`])
      ),
    ])
  ) as unknown as LocaleMessages;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function loadI18n(
  loaders: Partial<Record<AppLanguage, Loader>>,
  browserLanguage = 'en-US'
): Promise<I18n> {
  vi.resetModules();
  vi.stubGlobal('navigator', { language: browserLanguage });
  vi.doMock('./registry', () => ({
    englishMessages: english,
    localeLoaders: loaders,
  }));
  return import('./index');
}

afterEach(() => {
  vi.doUnmock('./registry');
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('lazy locales', () => {
  it('has English without loading anything', async () => {
    const ja = vi.fn(async () => fakeLocale('ja'));
    const i18n = await loadI18n({ ja });
    expect(i18n.t('common', 'save')).toBe('Save');
    expect(ja).not.toHaveBeenCalled();
  });

  it('loads a language once, then switches and notifies', async () => {
    const request = deferred<LocaleMessages>();
    const ja = vi.fn(() => request.promise);
    const i18n = await loadI18n({ ja });
    const listener = vi.fn();
    i18n.subscribeLanguage(listener);

    const switched = i18n.setLanguage('ja');
    // Still the previous language, fully translated, while loading.
    expect(i18n.getLanguage()).toBe('en');
    expect(i18n.t('common', 'save')).toBe('Save');
    expect(listener).not.toHaveBeenCalled();

    request.resolve(fakeLocale('ja'));
    await switched;
    expect(i18n.getLanguage()).toBe('ja');
    expect(i18n.t('common', 'save')).toBe('ja:Save');
    expect(listener).toHaveBeenCalledTimes(1);

    await i18n.setLanguage('en');
    // Cached: switches synchronously, without another request.
    void i18n.setLanguage('ja');
    expect(i18n.getLanguage()).toBe('ja');
    expect(ja).toHaveBeenCalledTimes(1);
  });

  it('shares one request between concurrent loads', async () => {
    const ko = vi.fn(async () => fakeLocale('ko'));
    const i18n = await loadI18n({ ko });
    await Promise.all([
      i18n.ensureLanguageLoaded('ko'),
      i18n.ensureLanguageLoaded('ko'),
      i18n.setLanguage('ko'),
    ]);
    expect(ko).toHaveBeenCalledTimes(1);
    expect(i18n.t('common', 'cancel')).toBe('ko:Cancel');
  });

  it('lets the latest request win when loads overlap', async () => {
    const slow = deferred<LocaleMessages>();
    const i18n = await loadI18n({
      ja: () => slow.promise,
      ko: async () => fakeLocale('ko'),
    });
    const first = i18n.setLanguage('ja');
    await i18n.setLanguage('ko');
    expect(i18n.getLanguage()).toBe('ko');

    slow.resolve(fakeLocale('ja'));
    await first;
    expect(i18n.getLanguage()).toBe('ko');
    expect(i18n.t('common', 'save')).toBe('ko:Save');
  });

  it('switches back to a loaded language while another one loads', async () => {
    const slow = deferred<LocaleMessages>();
    const i18n = await loadI18n({ ja: () => slow.promise });
    const pending = i18n.setLanguage('ja');
    await i18n.setLanguage('en');
    slow.resolve(fakeLocale('ja'));
    await pending;
    expect(i18n.getLanguage()).toBe('en');
  });

  it('falls back to English per key when a locale lacks one', async () => {
    const partial = fakeLocale('ja') as unknown as Record<
      string,
      Record<string, string>
    >;
    delete partial.common?.save;
    const i18n = await loadI18n({
      ja: async () => partial as unknown as LocaleMessages,
    });
    await i18n.setLanguage('ja');
    expect(i18n.t('common', 'save')).toBe('Save');
    expect(i18n.t('common', 'cancel')).toBe('ja:Cancel');
  });

  it('applies the language with English strings when loading fails, and retries later', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ja = vi
      .fn<Loader>()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValueOnce(fakeLocale('ja'));
    const i18n = await loadI18n({ ja });

    await expect(i18n.setLanguage('ja')).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledOnce();
    expect(i18n.getLanguage()).toBe('ja');
    expect(i18n.t('common', 'save')).toBe('Save');
    // English plural rules go with the English text: Japanese would pick
    // "other" for 1 ("1 booths").
    expect(i18n.tn('events', 'boothCount', 1)).toBe('1 booth');

    await i18n.ensureLanguageLoaded('ja');
    expect(ja).toHaveBeenCalledTimes(2);
    expect(i18n.t('common', 'save')).toBe('ja:Save');
  });

  it('rejects ensureLanguageLoaded for a language without messages', async () => {
    const i18n = await loadI18n({});
    await expect(i18n.ensureLanguageLoaded('ko')).rejects.toThrow(
      'No messages for language "ko"'
    );
  });

  it('starts in the detected language and translates it once loaded', async () => {
    const i18n = await loadI18n({ ja: async () => fakeLocale('ja') }, 'ja-JP');
    expect(i18n.getLanguage()).toBe('ja');
    expect(i18n.t('common', 'save')).toBe('Save');
    await i18n.ensureLanguageLoaded('ja');
    expect(i18n.t('common', 'save')).toBe('ja:Save');
  });
});
