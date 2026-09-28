import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveMonetizationConfig } from '@/config/monetization';
import {
  LIMITS,
  SponsorFeedError,
  parseIsoDateTime,
  parseSponsorFeed,
  sanitizeText,
} from './feed';

const IMAGE_HOSTS = ['raw.githubusercontent.com'];

function creative(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acme-1',
    placements: ['footer'],
    locales: ['*'],
    title: 'Acme pens',
    clickUrl: 'https://acme.example/pens',
    sponsorName: 'Acme',
    ...overrides,
  };
}

function feedWith(...creatives: unknown[]) {
  return { version: 1, updatedAt: '2026-09-29T00:00:00Z', creatives };
}

function parseOne(overrides: Record<string, unknown>) {
  return parseSponsorFeed(feedWith(creative(overrides)), {
    imageHosts: IMAGE_HOSTS,
  });
}

describe('parseSponsorFeed envelope', () => {
  it.each([
    ['not an object', null],
    ['an array', []],
    ['a wrong version', { ...feedWith(), version: 2 }],
    ['a missing updatedAt', { version: 1, creatives: [] }],
    ['a bad updatedAt', { ...feedWith(), updatedAt: 'yesterday' }],
    ['non-array creatives', { ...feedWith(), creatives: {} }],
  ])('rejects %s', (_label, raw) => {
    expect(() => parseSponsorFeed(raw)).toThrow(SponsorFeedError);
  });

  it('accepts an empty creative list', () => {
    expect(parseSponsorFeed(feedWith()).feed.creatives).toEqual([]);
  });
});

describe('parseSponsorFeed creatives', () => {
  it('keeps a valid creative with every optional field', () => {
    const full = creative({
      body: 'Gel pens for fan letters',
      imageUrl: 'https://raw.githubusercontent.com/o/r/main/sponsors/a.webp',
      cta: 'Shop',
      startsAt: '2026-10-01T00:00:00+09:00',
      endsAt: '2026-10-31T23:59:59+09:00',
      weight: 5,
      placements: ['footer', 'settings'],
      locales: ['ko', 'ja'],
    });
    const { feed, issues } = parseSponsorFeed(feedWith(full), {
      imageHosts: IMAGE_HOSTS,
    });
    expect(issues).toEqual([]);
    expect(feed.creatives).toEqual([full]);
  });

  it('skips invalid creatives individually and reports why', () => {
    const { feed, issues } = parseSponsorFeed(
      feedWith(
        creative({ id: 'ok-1' }),
        creative({ id: 'bad-1', clickUrl: 'javascript:alert(1)' }),
        'not an object',
        creative({ id: 'ok-2' })
      )
    );
    expect(feed.creatives.map((c) => c.id)).toEqual(['ok-1', 'ok-2']);
    expect(issues).toEqual([
      { index: 1, id: 'bad-1', reason: 'clickUrl: must use https' },
      { index: 2, id: undefined, reason: 'not an object' },
    ]);
  });

  it.each([
    ['javascript: click URL', { clickUrl: 'javascript:alert(1)' }],
    ['http: click URL', { clickUrl: 'http://acme.example/' }],
    ['data: click URL', { clickUrl: 'data:text/html,<script>1</script>' }],
    ['relative click URL', { clickUrl: '/pens' }],
    ['click URL with credentials', { clickUrl: 'https://u:p@acme.example/' }],
    [
      'over-long click URL',
      { clickUrl: `https://a.example/${'x'.repeat(2048)}` },
    ],
    ['http: image', { imageUrl: 'http://raw.githubusercontent.com/a.png' }],
    ['data: image', { imageUrl: 'data:image/png;base64,AAAA' }],
    ['javascript: image', { imageUrl: 'javascript:alert(1)' }],
    ['SVG image', { imageUrl: 'https://raw.githubusercontent.com/a.svg' }],
    ['image on another host', { imageUrl: 'https://tracker.example/a.png' }],
    ['unknown placement', { placements: ['footer', 'popup'] }],
    ['empty placements', { placements: [] }],
    ['unknown locale', { locales: ['xx'] }],
    ['missing title', { title: undefined }],
    ['blank title', { title: '   ' }],
    ['over-long title', { title: 'a'.repeat(LIMITS.title + 1) }],
    ['over-long body', { body: 'a'.repeat(LIMITS.body + 1) }],
    ['over-long cta', { cta: 'a'.repeat(LIMITS.cta + 1) }],
    [
      'over-long sponsorName',
      { sponsorName: 'a'.repeat(LIMITS.sponsorName + 1) },
    ],
    ['non-string body', { body: 42 }],
    ['bad id', { id: 'has space' }],
    ['date-only startsAt', { startsAt: '2026-10-01' }],
    ['impossible date', { startsAt: '2026-02-31T00:00:00Z' }],
    ['unparseable endsAt', { endsAt: 'soon' }],
    [
      'end before start',
      {
        startsAt: '2026-10-02T00:00:00Z',
        endsAt: '2026-10-01T00:00:00Z',
      },
    ],
    ['fractional weight', { weight: 1.5 }],
    ['zero weight', { weight: 0 }],
    ['weight over 100', { weight: 101 }],
  ])('rejects a %s', (_label, overrides) => {
    const { feed, issues } = parseOne(overrides);
    expect(feed.creatives).toEqual([]);
    expect(issues).toHaveLength(1);
  });

  it('measures length in characters, not UTF-16 units', () => {
    const cjk = '가'.repeat(LIMITS.title);
    expect(parseOne({ title: cjk }).feed.creatives[0]?.title).toBe(cjk);
    const emoji = String.fromCodePoint(0x1f330).repeat(LIMITS.title);
    expect(parseOne({ title: emoji }).feed.creatives).toHaveLength(1);
  });

  it('strips control, zero-width and bidi characters', () => {
    const nul = String.fromCharCode(0);
    const rlo = String.fromCharCode(0x202e);
    const zwsp = String.fromCharCode(0x200b);
    const { feed } = parseOne({
      title: `  Acme${nul}${rlo} pens${zwsp}\n\tnow  `,
      sponsorName: `Ac${zwsp}me`,
    });
    expect(feed.creatives[0]?.title).toBe('Acme pens now');
    expect(feed.creatives[0]?.sponsorName).toBe('Acme');
  });

  it('keeps markup as plain text', () => {
    const { feed } = parseOne({ title: '<img src=x onerror=alert(1)>' });
    expect(feed.creatives[0]?.title).toBe('<img src=x onerror=alert(1)>');
  });

  it('skips duplicate ids after the first', () => {
    const { feed, issues } = parseSponsorFeed(
      feedWith(creative({ title: 'first' }), creative({ title: 'second' }))
    );
    expect(feed.creatives.map((c) => c.title)).toEqual(['first']);
    expect(issues[0]?.reason).toBe('duplicate id');
  });

  it(`caps the feed at ${LIMITS.creatives} creatives`, () => {
    const many = Array.from({ length: LIMITS.creatives + 3 }, (_, i) =>
      creative({ id: `c-${i}` })
    );
    const { feed, issues } = parseSponsorFeed(feedWith(...many));
    expect(feed.creatives).toHaveLength(LIMITS.creatives);
    expect(issues).toHaveLength(3);
  });

  it('dedupes placements and ignores unknown fields', () => {
    const { feed } = parseOne({
      placements: ['footer', 'footer'],
      trackingPixel: 'https://tracker.example/p.gif',
    });
    expect(feed.creatives[0]?.placements).toEqual(['footer']);
    expect(feed.creatives[0]).not.toHaveProperty('trackingPixel');
  });

  it('is idempotent, so cached feeds re-validate unchanged', () => {
    const once = parseOne({ title: ' spaced   title ', weight: 3 }).feed;
    expect(parseSponsorFeed(once, { imageHosts: IMAGE_HOSTS }).feed).toEqual(
      once
    );
  });
});

describe('parseIsoDateTime', () => {
  it('parses zoned date-times', () => {
    expect(parseIsoDateTime('2026-10-01T09:00:00+09:00')).toBe(
      Date.UTC(2026, 9, 1, 0, 0, 0)
    );
    expect(parseIsoDateTime('2026-10-01T00:00Z')).toBe(Date.UTC(2026, 9, 1));
  });

  it.each(['2026-10-01', '2026-10-01T00:00:00', '2026-13-01T00:00:00Z', 1])(
    'rejects %s',
    (value) => {
      expect(parseIsoDateTime(value)).toBeNull();
    }
  );
});

describe('sanitizeText', () => {
  it('collapses whitespace and keeps emoji joiners', () => {
    const family = ['\u{1F468}', '\u{1F469}'].join(String.fromCharCode(0x200d));
    expect(sanitizeText(`a \n b ${family}`)).toBe(`a b ${family}`);
  });
});

describe('sponsors/feed.json', () => {
  it('is a valid feed with no skipped creatives', () => {
    const path = fileURLToPath(
      new URL('../../../sponsors/feed.json', import.meta.url)
    );
    const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const { sponsorImageHosts } = resolveMonetizationConfig({});
    const { feed, issues } = parseSponsorFeed(raw, {
      imageHosts: sponsorImageHosts,
    });
    expect(issues).toEqual([]);
    expect(feed.creatives.length).toBeGreaterThan(0);
  });
});
