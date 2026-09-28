import { describe, expect, it, vi } from 'vitest';
import { createSnapshot } from '../snapshot';
import {
  comparableText,
  enrichXSnapshot,
  mergeTweetText,
  parseSyndicationTweet,
  syndicationToken,
  syndicationUrl,
} from './x';

/** Shape observed from tweet-result on 2026-09-29 (id 266031293945503744). */
const OBAMA = {
  __typename: 'Tweet',
  lang: 'en',
  created_at: '2012-11-07T04:16:18.000Z',
  display_text_range: [0, 37],
  entities: {
    media: [
      {
        display_url: 'pic.x.com/bAJE6Vom',
        expanded_url: 'https://x.com/BarackObama/status/266031293945503744/photo/1',
        indices: [17, 37],
        url: 'http://t.co/bAJE6Vom',
      },
    ],
  },
  id_str: '266031293945503744',
  text: 'Four more years. http://t.co/bAJE6Vom',
  user: { id_str: '813286', name: 'Barack Obama', screen_name: 'BarackObama' },
  mediaDetails: [
    {
      media_url_https: 'https://pbs.twimg.com/media/A7EiDWcCYAAZT1D.jpg',
      original_info: { height: 532, width: 800 },
      type: 'photo',
    },
  ],
  photos: [{ url: 'https://pbs.twimg.com/media/A7EiDWcCYAAZT1D.jpg', width: 800, height: 532 }],
  isEdited: false,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('syndicationToken', () => {
  it('matches the widget derivation', () => {
    // Values computed with ((id / 1e15) * PI).toString(36).replace(/(0+|\.)/g, '')
    // and accepted by the endpoint on 2026-09-29.
    expect(syndicationToken('266031293945503744')).toBe('n7rfhxzwhkd');
    expect(syndicationToken('1585841080431321088')).toBe('3ue2efeb2g');
    expect(syndicationUrl('20')).toMatch(
      /^https:\/\/cdn\.syndication\.twimg\.com\/tweet-result\?id=20&token=[0-9a-z]+$/
    );
  });
});

describe('parseSyndicationTweet', () => {
  it('parses text, author, date and photos, dropping media links', () => {
    expect(parseSyndicationTweet(OBAMA)).toEqual({
      id: '266031293945503744',
      text: 'Four more years.',
      lang: 'en',
      truncated: false,
      author: { name: 'Barack Obama', handle: 'BarackObama' },
      publishedAt: '2012-11-07T04:16:18.000Z',
      photos: [{ url: 'https://pbs.twimg.com/media/A7EiDWcCYAAZT1D.jpg', width: 800, height: 532 }],
      links: [],
      expansions: {},
    });
  });

  it('strips reply mentions, expands links and decodes entities', () => {
    const parsed = parseSyndicationTweet({
      __typename: 'Tweet',
      id_str: '1',
      lang: 'ja',
      display_text_range: [10, 60],
      text: '@someone😀 新刊 &amp; グッズ &lt;A-1&gt; https://t.co/abc',
      entities: {
        urls: [{ url: 'https://t.co/abc', expanded_url: 'https://booth.pm/ja/items/1' }],
      },
      note_tweet: { id: 'Tm90ZVR3ZWV0' },
    });
    expect(parsed?.text).toBe('新刊 & グッズ <A-1> https://booth.pm/ja/items/1');
    expect(parsed?.links).toEqual(['https://booth.pm/ja/items/1']);
    expect(parsed?.expansions).toEqual({ 'https://t.co/abc': 'https://booth.pm/ja/items/1' });
    expect(parsed?.truncated).toBe(true);
  });

  it('falls back to mediaDetails photos', () => {
    const { photos: _photos, ...withoutPhotos } = OBAMA;
    expect(parseSyndicationTweet(withoutPhotos)?.photos).toEqual([
      { url: 'https://pbs.twimg.com/media/A7EiDWcCYAAZT1D.jpg' },
    ]);
  });

  it.each([
    ['empty object (missing token)', {}],
    ['tombstone', { __typename: 'TweetTombstone', tombstone: { text: 'deleted' } }],
    ['no text', { __typename: 'Tweet', id_str: '1' }],
    ['not an object', 'nope'],
  ])('returns null for %s', (_label, payload) => {
    expect(parseSyndicationTweet(payload)).toBeNull();
  });
});

describe('comparableText / mergeTweetText', () => {
  it('compares letters and digits only', () => {
    expect(comparableText('Hi, world! https://t.co/x booth.pm/ja 😀')).toBe('hiworld');
  });

  it('same text: original wins (expanded links), no displayedText', () => {
    expect(mergeTweetText('Hello world 😀 t.co/abc', 'Hello, world! https://e.com/a')).toEqual({
      text: 'Hello, world! https://e.com/a',
      displayedText: null,
    });
  });

  it('translated DOM: original as text, DOM as displayedText', () => {
    expect(mergeTweetText('안녕하세요', 'Hello')).toEqual({
      text: 'Hello',
      displayedText: '안녕하세요',
    });
  });

  it('untranslated long post: the longer DOM continuation wins', () => {
    expect(mergeTweetText('Line one. Line two continues here.', 'Line one. Line tw…')).toEqual({
      text: 'Line one. Line two continues here.',
      displayedText: null,
    });
  });

  it('cut-off DOM ("Show more"): original wins', () => {
    expect(mergeTweetText('Line one. Line', 'Line one. Line two.')).toEqual({
      text: 'Line one. Line two.',
      displayedText: null,
    });
  });

  it('no original: DOM text stays', () => {
    expect(mergeTweetText('DOM', null)).toEqual({ text: 'DOM', displayedText: null });
  });
});

describe('enrichXSnapshot', () => {
  const base = createSnapshot({
    site: 'x',
    url: 'https://x.com/BarackObama/status/266031293945503744',
    canonicalUrl: 'https://x.com/BarackObama/status/266031293945503744',
    capturedAt: 1,
    text: '4년 더.',
    lang: 'ko',
    links: ['https://t.co/bAJE6Vom'],
  });

  it('prefers the complete syndication copy over the status page', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      String(input).startsWith('https://cdn.syndication.twimg.com/')
        ? json(OBAMA)
        : new Response('<meta property="og:description" content="Four more years. And a longer page text.">')
    );
    const result = await enrichXSnapshot(base, { fetch: fetchMock });
    const [url, init] = fetchMock.mock.calls.find(([input]) =>
      String(input).startsWith('https://cdn.syndication.twimg.com/')
    ) as unknown as [string, RequestInit];
    expect(url).toBe(syndicationUrl('266031293945503744'));
    expect(init.credentials).toBe('omit');
    expect(result).toMatchObject({
      text: 'Four more years.',
      displayedText: '4년 더.',
      lang: 'en',
      author: { name: 'Barack Obama', handle: 'BarackObama' },
      publishedAt: '2012-11-07T04:16:18.000Z',
      links: [],
    });
    expect(result.images).toEqual([
      {
        url: 'https://pbs.twimg.com/media/A7EiDWcCYAAZT1D?format=jpg&name=orig',
        width: 800,
        height: 532,
      },
    ]);
  });

  it('requests the status page in parallel instead of after syndication', async () => {
    let releaseSyndication: (response: Response) => void = () => {};
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      String(input).startsWith('https://cdn.syndication.twimg.com/')
        ? new Promise<Response>((resolve) => (releaseSyndication = resolve))
        : Promise.resolve(
            new Response('<meta property="og:description" content="Four more years and so on, the full long post.">')
          )
    );
    const pending = enrichXSnapshot(base, { fetch: fetchMock });
    // Both requests are out before the syndication response arrives.
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      'https://x.com/i/status/266031293945503744',
      syndicationUrl('266031293945503744'),
    ]);
    releaseSyndication(json({ ...OBAMA, text: 'Four more years and so on', note_tweet: { id: 'x' } }));
    expect((await pending).text).toBe('Four more years and so on, the full long post.');
  });

  it('expands t.co links in place and drops media links', async () => {
    const tweet = {
      ...OBAMA,
      entities: {
        ...OBAMA.entities,
        urls: [
          { url: 'http://t.co/other', expanded_url: 'https://shop.example.com/' },
          { url: 'https://t.co/clicked', expanded_url: 'https://forms.example.org/f1' },
        ],
      },
    };
    const fetchMock = vi.fn(async () => json(tweet));
    const snapshot = createSnapshot({
      ...base,
      // The right-clicked link was put first by the capture.
      links: ['https://t.co/clicked', 'https://example.com/plain', 'https://t.co/bAJE6Vom'],
    });
    const result = await enrichXSnapshot(snapshot, { fetch: fetchMock });
    expect(result.links).toEqual([
      'https://forms.example.org/f1',
      'https://example.com/plain',
      'https://shop.example.com/',
    ]);
  });

  it('falls back to og:description when syndication fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('https://cdn.syndication.twimg.com/')) {
        return new Response('<html>Nothing to see here</html>', { status: 404 });
      }
      expect(url).toBe('https://x.com/i/status/266031293945503744');
      return new Response(
        '<html><head><meta property="og:description" content="Four more years." nonce="n"/></head></html>',
        { status: 200 }
      );
    });
    const result = await enrichXSnapshot(base, { fetch: fetchMock });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.text).toBe('Four more years.');
    expect(result.displayedText).toBe('4년 더.');
    // Without the syndication language, the DOM lang may be the translation's.
    expect(result.lang).toBeNull();
    // t.co links stay when their targets are unknown.
    expect(result.links).toEqual(['https://t.co/bAJE6Vom']);
  });

  it('prefers a longer og:description for truncated long posts', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      String(input).startsWith('https://cdn.syndication.twimg.com/')
        ? json({ ...OBAMA, text: 'Four more years and so on', note_tweet: { id: 'x' } })
        : new Response(
            '<meta property="og:description" content="Four more years and so on, the full long post.">'
          )
    );
    const result = await enrichXSnapshot(base, { fetch: fetchMock });
    expect(result.text).toBe('Four more years and so on, the full long post.');
  });

  it('keeps the DOM text when every source fails', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await enrichXSnapshot(base, { fetch: fetchMock })).toBe(base);
  });

  it('does nothing for snapshots without a status id', async () => {
    const fetchMock = vi.fn();
    const home = createSnapshot({ site: 'x', url: 'https://x.com/home', capturedAt: 1 });
    expect(await enrichXSnapshot(home, { fetch: fetchMock })).toBe(home);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
