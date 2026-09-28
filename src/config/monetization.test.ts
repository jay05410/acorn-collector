import { describe, expect, it } from 'vitest';
import { resolveMonetizationConfig, toHttpsUrl } from './monetization';

describe('resolveMonetizationConfig', () => {
  it('uses safe defaults when nothing is set', () => {
    const config = resolveMonetizationConfig({});
    expect(config.sponsorFeedUrl).toBe(
      'https://raw.githubusercontent.com/jay05410/acorn-collector/main/sponsors/feed.json'
    );
    expect(config.sponsorImageHosts).toEqual(['raw.githubusercontent.com']);
    expect(config.donationLinks).toEqual({
      buyMeACoffee: '',
      githubSponsors: 'https://github.com/sponsors/jay05410',
    });
    expect(config.sponsorContact).toBe(
      'https://github.com/jay05410/acorn-collector/issues'
    );
    expect(config.webStoreUrl).toBe('');
    expect(config.privacyPolicyUrl).toBe(
      'https://github.com/jay05410/acorn-collector/blob/main/docs/PRIVACY.md'
    );
    expect(config.features).toEqual({
      sponsorSlots: true,
      remoteSponsorFeed: true,
    });
  });

  it('applies valid overrides', () => {
    const config = resolveMonetizationConfig({
      VITE_SPONSOR_FEED_URL: 'https://ads.example/feed.json',
      VITE_BMC_URL: 'https://buymeacoffee.com/acorn',
      VITE_GH_SPONSORS_URL: 'https://github.com/sponsors/acorn',
      VITE_SPONSOR_CONTACT_URL: 'mailto:ads@acorn.example',
      VITE_CWS_URL: 'https://chromewebstore.google.com/detail/abc',
      VITE_PRIVACY_POLICY_URL: 'https://acorn.example/privacy',
      VITE_SPONSOR_SLOTS: 'false',
      VITE_REMOTE_SPONSOR_FEED: 'off',
    });
    expect(config.sponsorFeedUrl).toBe('https://ads.example/feed.json');
    expect(config.sponsorImageHosts).toEqual(['ads.example']);
    expect(config.donationLinks.buyMeACoffee).toBe(
      'https://buymeacoffee.com/acorn'
    );
    expect(config.sponsorContact).toBe('mailto:ads@acorn.example');
    expect(config.webStoreUrl).toBe(
      'https://chromewebstore.google.com/detail/abc'
    );
    expect(config.privacyPolicyUrl).toBe('https://acorn.example/privacy');
    expect(config.features).toEqual({
      sponsorSlots: false,
      remoteSponsorFeed: false,
    });
  });

  it('ignores insecure or malformed overrides', () => {
    const config = resolveMonetizationConfig({
      VITE_SPONSOR_FEED_URL: 'http://ads.example/feed.json',
      VITE_BMC_URL: 'javascript:alert(1)',
      VITE_GH_SPONSORS_URL: 'not a url',
      VITE_SPONSOR_CONTACT_URL: 'mailto:',
      VITE_SPONSOR_SLOTS: 'maybe',
    });
    const defaults = resolveMonetizationConfig({});
    expect(config.sponsorFeedUrl).toBe(defaults.sponsorFeedUrl);
    expect(config.donationLinks).toEqual(defaults.donationLinks);
    expect(config.sponsorContact).toBe(defaults.sponsorContact);
    expect(config.features.sponsorSlots).toBe(true);
  });

  it('turns a donation link off with "off"', () => {
    expect(
      resolveMonetizationConfig({ VITE_GH_SPONSORS_URL: 'off' }).donationLinks
        .githubSponsors
    ).toBe('');
  });
});

describe('toHttpsUrl', () => {
  it.each([
    ['https://a.example/x', 'https://a.example/x'],
    ['  https://a.example  ', 'https://a.example/'],
    ['http://a.example', null],
    ['https://user:pw@a.example', null],
    ['', null],
    [undefined, null],
    [42, null],
  ])('%s -> %s', (input, expected) => {
    expect(toHttpsUrl(input)).toBe(expected);
  });
});
