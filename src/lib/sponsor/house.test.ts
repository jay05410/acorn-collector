import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getLanguage, setLanguage } from '@/i18n';
import type { AppLanguage } from '@/i18n/languages';
import { parseSponsorFeed } from './feed';
import {
  houseCreatives,
  resolveWebStoreUrl,
  webStoreReviewsUrl,
  type HouseLinks,
} from './house';

const LINKS: HouseLinks = {
  donationLinks: {
    buyMeACoffee: 'https://buymeacoffee.com/acorn',
    githubSponsors: 'https://github.com/sponsors/acorn',
  },
  sponsorContact: 'mailto:ads@acorn.example',
  webStoreUrl: 'https://chromewebstore.google.com/detail/abc',
  homepageUrl: 'https://github.com/acorn/acorn-collector',
};

let initial: AppLanguage;

beforeEach(() => {
  initial = getLanguage();
  setLanguage('en');
});

afterEach(() => {
  setLanguage(initial);
});

describe('resolveWebStoreUrl', () => {
  const storeRuntime = {
    id: 'abcdefghijklmnopabcdefghijklmnop',
    getManifest: () => ({
      update_url: 'https://clients2.google.com/service/update2/crx',
    }),
  };

  it('prefers the configured URL', () => {
    expect(
      resolveWebStoreUrl('https://example.com/listing', storeRuntime)
    ).toBe('https://example.com/listing');
  });

  it('derives the listing from a Chrome Web Store install', () => {
    expect(resolveWebStoreUrl('', storeRuntime)).toBe(
      'https://chromewebstore.google.com/detail/abcdefghijklmnopabcdefghijklmnop'
    );
  });

  it('has no listing for unpacked or self-hosted builds', () => {
    expect(
      resolveWebStoreUrl('', { id: 'x', getManifest: () => ({}) })
    ).toBeNull();
    expect(
      resolveWebStoreUrl('', {
        id: 'x',
        getManifest: () => ({ update_url: 'https://evil.example/update' }),
      })
    ).toBeNull();
    expect(resolveWebStoreUrl('', undefined)).toBeNull();
  });
});

describe('webStoreReviewsUrl', () => {
  it.each([
    [
      'https://chromewebstore.google.com/detail/abc',
      'https://chromewebstore.google.com/detail/abc/reviews',
    ],
    [
      'https://chromewebstore.google.com/detail/abc/',
      'https://chromewebstore.google.com/detail/abc/reviews',
    ],
    [
      'https://chromewebstore.google.com/detail/abc?hl=ko#top',
      'https://chromewebstore.google.com/detail/abc/reviews?hl=ko#top',
    ],
    [
      'https://chromewebstore.google.com/detail/abc/reviews?hl=ja',
      'https://chromewebstore.google.com/detail/abc/reviews?hl=ja',
    ],
  ])('%s -> %s', (listing, reviews) => {
    expect(webStoreReviewsUrl(listing)).toBe(reviews);
  });

  it('is null for an unusable listing URL', () => {
    expect(webStoreReviewsUrl('not a url')).toBeNull();
  });
});

describe('houseCreatives', () => {
  it('builds localized promos with the right links', () => {
    const byId = new Map(houseCreatives(LINKS).map((c) => [c.id, c]));
    expect([...byId.keys()]).toEqual([
      'house-donate',
      'house-rate',
      'house-share',
      'house-advertise',
    ]);
    expect(byId.get('house-donate')?.clickUrl).toBe(
      LINKS.donationLinks.buyMeACoffee
    );
    expect(byId.get('house-rate')?.clickUrl).toBe(
      'https://chromewebstore.google.com/detail/abc/reviews'
    );
    expect(byId.get('house-share')?.clickUrl).toBe(LINKS.webStoreUrl);
    expect(byId.get('house-advertise')?.clickUrl).toBe(LINKS.sponsorContact);
    expect(byId.get('house-donate')?.title).toBe('Enjoying Acorn Collector?');
  });

  it('keeps the listing query when linking to its reviews', () => {
    const rate = houseCreatives({
      ...LINKS,
      webStoreUrl: 'https://chromewebstore.google.com/detail/abc?hl=ko',
    }).find((c) => c.id === 'house-rate');
    expect(rate?.clickUrl).toBe(
      'https://chromewebstore.google.com/detail/abc/reviews?hl=ko'
    );
  });

  it('follows the current language', () => {
    setLanguage('ja');
    const donate = houseCreatives(LINKS).find((c) => c.id === 'house-donate');
    expect(donate?.title).toBe('どんぐりポケットはお役に立っていますか？');
    expect(donate?.sponsorName).toBe('どんぐりポケット');
  });

  it('falls back to GitHub Sponsors, and drops promos without a link', () => {
    const creatives = houseCreatives({
      ...LINKS,
      donationLinks: {
        buyMeACoffee: '',
        githubSponsors: 'https://gh.example/s',
      },
      webStoreUrl: null,
    });
    expect(creatives.map((c) => c.id)).toEqual([
      'house-donate',
      'house-share',
      'house-advertise',
    ]);
    expect(creatives[0]?.clickUrl).toBe('https://gh.example/s');
    expect(creatives[1]?.clickUrl).toBe(LINKS.homepageUrl);

    const noDonations = houseCreatives({
      ...LINKS,
      donationLinks: { buyMeACoffee: '', githubSponsors: '' },
    });
    expect(noDonations.some((c) => c.id === 'house-donate')).toBe(false);
  });

  it.each(['ko', 'en', 'ja', 'zh-CN', 'zh-TW'] as const)(
    'passes the feed validator in %s (except mailto links)',
    (language) => {
      setLanguage(language);
      const creatives = houseCreatives({
        ...LINKS,
        sponsorContact: 'https://github.com/acorn/acorn-collector/issues',
      }).map(({ icon: _icon, ...creative }) => creative);
      const { issues } = parseSponsorFeed({
        version: 1,
        updatedAt: '2026-09-29T00:00:00Z',
        creatives,
      });
      expect(issues).toEqual([]);
    }
  );
});
