import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveMonetizationConfig } from '@/config/monetization';
import { getLanguage, setLanguage, t } from '@/i18n';
import type { AppLanguage } from '@/i18n/languages';
import { adsNetworkNotice } from './disclosure';

const CORE = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'] as const;
let initial: AppLanguage;

beforeEach(() => {
  initial = getLanguage();
});

afterEach(() => {
  setLanguage(initial);
});

describe('adsNetworkNotice', () => {
  it.each(CORE)('names the configured feed host in %s', (language) => {
    setLanguage(language);
    const config = resolveMonetizationConfig({
      VITE_SPONSOR_FEED_URL: 'https://ads.acorn.example/v1/feed.json',
    });
    const notice = adsNetworkNotice(config);
    expect(notice).toContain('ads.acorn.example');
    expect(notice).not.toContain('{host}');
    expect(notice).not.toContain('GitHub');
  });

  it('names the default host by default', () => {
    setLanguage('en');
    expect(adsNetworkNotice(resolveMonetizationConfig({}))).toContain(
      'raw.githubusercontent.com'
    );
  });

  it.each(CORE)(
    'says nothing is downloaded when the remote feed is off in %s',
    (language) => {
      setLanguage(language);
      const config = resolveMonetizationConfig({
        VITE_REMOTE_SPONSOR_FEED: 'off',
      });
      expect(adsNetworkNotice(config)).toBe(t('support', 'aboutAdsNetworkOff'));
      expect(adsNetworkNotice(config)).not.toContain('githubusercontent');
    }
  );
});
