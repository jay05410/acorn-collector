import { describe, expect, it } from 'vitest';
import {
  createSnapshot,
  detectSite,
  isPageSnapshot,
  MAX_LINKS,
  MAX_TEXT_LENGTH,
  normalizeLang,
  normalizeLinks,
  normalizeSnapshot,
  normalizeText,
  stripTrackingParams,
  withLeadingImages,
} from './snapshot';

describe('detectSite', () => {
  it.each([
    ['https://x.com/user/status/1', 'x'],
    ['https://twitter.com/user', 'x'],
    ['https://mobile.twitter.com/user/status/1', 'x'],
    ['https://bsky.app/profile/a.bsky.social/post/3k', 'bluesky'],
    ['https://booth.pm/ja/items/1', 'booth'],
    ['https://shop.booth.pm/items/1', 'booth'],
    ['https://www.instagram.com/p/abc/', 'instagram'],
    ['https://www.threads.net/@a/post/1', 'threads'],
    ['https://www.threads.com/@a/post/1', 'threads'],
    ['https://www.pixiv.net/artworks/1', 'pixiv'],
    ['https://witchform.com/formViewer/1', 'witchform'],
    ['https://example.com/x.com', 'generic'],
    ['https://notx.com/', 'generic'],
    ['not a url', 'generic'],
  ])('%s -> %s', (url, site) => {
    expect(detectSite(url)).toBe(site);
  });
});

describe('stripTrackingParams', () => {
  it('removes utm/click ids and keeps other params with their encoding', () => {
    expect(
      stripTrackingParams('https://e.com/p?utm_source=x&id=a%20b&fbclid=1&q=%E3%81%82#top')
    ).toBe('https://e.com/p?id=a%20b&q=%E3%81%82#top');
  });

  it('drops the query entirely when only trackers remain', () => {
    expect(stripTrackingParams('https://e.com/p?utm_medium=a&gclid=b')).toBe('https://e.com/p');
  });

  it('removes X share params only on X', () => {
    expect(stripTrackingParams('https://x.com/a/status/1?s=20&t=abc')).toBe(
      'https://x.com/a/status/1'
    );
    expect(stripTrackingParams('https://e.com/search?s=20')).toBe('https://e.com/search?s=20');
  });

  it('returns unparseable input unchanged', () => {
    expect(stripTrackingParams('::nope')).toBe('::nope');
  });
});

describe('normalizeLinks', () => {
  it('resolves, filters, strips, dedupes, excludes the page and caps', () => {
    const page = 'https://e.com/post?utm_source=feed';
    const links = normalizeLinks(
      [
        '/form?utm_campaign=a',
        'https://e.com/form',
        'https://e.com/post#comments',
        'mailto:a@b.c',
        'javascript:void(0)',
        ...Array.from({ length: 30 }, (_, i) => `https://o.com/${i}`),
      ],
      page
    );
    expect(links[0]).toBe('https://e.com/form');
    expect(links).not.toContain('https://e.com/post#comments');
    expect(links).toHaveLength(MAX_LINKS);
  });
});

describe('normalizeText', () => {
  it('collapses spacing and blank lines', () => {
    expect(normalizeText('  a \t b \n\n\n\n  c  \r\n d ')).toBe('a b\n\nc\nd');
  });

  it('caps at the limit with an ellipsis', () => {
    const result = normalizeText('x'.repeat(MAX_TEXT_LENGTH + 100));
    expect(result).toHaveLength(MAX_TEXT_LENGTH);
    expect(result.endsWith('…')).toBe(true);
  });

  it('does not split surrogate pairs', () => {
    const result = normalizeText(`a${'😀'.repeat(10)}`, 6);
    expect(result).toBe('a😀😀…');
    expect(result.length).toBeLessThanOrEqual(6);
  });
});

describe('normalizeLang', () => {
  it.each([
    ['ja', 'ja'],
    ['EN_us', 'en-us'],
    ['zh-TW', 'zh-TW'],
    ['und', null],
    ['qme', null],
    ['zxx', null],
    ['', null],
    ['not a tag', null],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeLang(input)).toBe(expected);
  });
});

describe('createSnapshot / normalizeSnapshot', () => {
  it('fills defaults and applies every limit', () => {
    const snapshot = createSnapshot({
      url: 'https://x.com/a/status/1?s=20',
      capturedAt: 5,
      title: '  A   title \n',
      text: 't'.repeat(MAX_TEXT_LENGTH * 2),
      displayedText: ' same ',
      selection: '   ',
      links: Array.from({ length: 40 }, (_, i) => `https://o.com/${i}?utm_source=x`),
      images: Array.from({ length: 12 }, (_, i) => ({ url: `https://i.com/${i}.jpg` })),
      lang: 'und',
      author: { name: ' ', handle: null, url: null },
      publishedAt: 'yesterday-ish',
      structured: { jsonLd: [], openGraph: {} },
      prefilledItems: [],
      prefilledCurrency: 'jpy',
    });
    expect(snapshot).toMatchObject({
      version: 1,
      capturedAt: 5,
      site: 'x',
      url: 'https://x.com/a/status/1',
      canonicalUrl: null,
      title: 'A title',
      lang: null,
      author: null,
      selection: null,
      publishedAt: null,
      structured: null,
      prefilledItems: null,
      prefilledCurrency: null,
    });
    expect(snapshot.text).toHaveLength(MAX_TEXT_LENGTH);
    expect(snapshot.displayedText).toBe('same');
    expect(snapshot.links).toHaveLength(MAX_LINKS);
    expect(snapshot.links[0]).toBe('https://o.com/0');
    expect(snapshot.images).toHaveLength(8);
    expect(isPageSnapshot(snapshot)).toBe(true);
  });

  it('drops displayedText equal to text and keeps a valid currency', () => {
    const snapshot = createSnapshot({
      url: 'https://booth.pm/ja/items/1',
      capturedAt: 1,
      text: 'Hello  world',
      displayedText: 'Hello world',
      prefilledItems: [
        { name: 'A', originalName: null, price: 500, category: 'other', options: [] },
      ],
      prefilledCurrency: 'jpy',
    });
    expect(snapshot.displayedText).toBeNull();
    expect(snapshot.prefilledCurrency).toBe('JPY');
  });

  it('caps JSON-LD by serialized size', () => {
    const big = { '@type': 'Thing', blob: 'x'.repeat(40_000) };
    const small = { '@type': 'Article', headline: 'h' };
    const snapshot = createSnapshot({
      url: 'https://e.com',
      capturedAt: 1,
      structured: { jsonLd: [big, small], openGraph: {} },
    });
    expect(snapshot.structured?.jsonLd).toEqual([small]);
  });

  it('is idempotent', () => {
    const once = createSnapshot({ url: 'https://e.com/?utm_source=a', capturedAt: 1, text: ' a ' });
    expect(normalizeSnapshot(once)).toEqual(once);
  });

  it('withLeadingImages puts images first and dedupes', () => {
    const base = createSnapshot({
      url: 'https://e.com',
      capturedAt: 1,
      images: [{ url: 'https://e.com/a.jpg' }, { url: 'https://e.com/b.jpg' }],
    });
    const result = withLeadingImages(base, [{ url: 'https://e.com/b.jpg' }]);
    expect(result.images.map((image) => image.url)).toEqual([
      'https://e.com/b.jpg',
      'https://e.com/a.jpg',
    ]);
  });
});

describe('isPageSnapshot', () => {
  it('rejects malformed values', () => {
    expect(isPageSnapshot(null)).toBe(false);
    expect(isPageSnapshot({ version: 2 })).toBe(false);
    const valid = createSnapshot({ url: 'https://e.com', capturedAt: 1 });
    expect(isPageSnapshot({ ...valid, images: [{}] })).toBe(false);
    expect(isPageSnapshot({ ...valid, links: [1] })).toBe(false);
  });
});
