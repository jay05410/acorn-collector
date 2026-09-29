import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LocaleMessages } from '@/i18n/define';
import english from '@/i18n/locales/en';
import { createDefaultSettings } from '@/lib/storage';

/** Fresh i18n modules with a mocked Japanese loader, so nothing is preloaded. */
async function load(browserLanguage: string) {
  vi.resetModules();
  vi.stubGlobal('navigator', { language: browserLanguage });
  const ja = vi.fn(async () => {
    const messages = structuredClone(english) as unknown as {
      common: { save: string };
    };
    messages.common.save = 'ja:Save';
    return messages as unknown as LocaleMessages;
  });
  vi.doMock('@/i18n/registry', () => ({
    englishMessages: english,
    localeLoaders: { ja },
  }));
  const i18n = await import('@/i18n');
  const { loadStartupSettings } = await import('./startup');
  return { i18n, ja, loadStartupSettings };
}

afterEach(() => {
  vi.doUnmock('@/i18n/registry');
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('loadStartupSettings', () => {
  it('loads and applies the saved language before resolving', async () => {
    const { i18n, ja, loadStartupSettings } = await load('en-US');
    const settings = { ...createDefaultSettings(), language: 'ja' as const };

    const result = await loadStartupSettings(async () => settings);

    expect(result).toBe(settings);
    expect(ja).toHaveBeenCalledOnce();
    expect(i18n.getLanguage()).toBe('ja');
    expect(i18n.t('common', 'save')).toBe('ja:Save');
  });

  it('still loads the detected language when settings cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { i18n, loadStartupSettings } = await load('ja-JP');

    const result = await loadStartupSettings(async () => {
      throw new Error('storage unavailable');
    });

    expect(result).toBeUndefined();
    expect(i18n.getLanguage()).toBe('ja');
    expect(i18n.t('common', 'save')).toBe('ja:Save');
  });
});
