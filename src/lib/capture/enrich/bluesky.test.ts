import { describe, expect, it, vi } from 'vitest';
import { createSnapshot } from '../snapshot';
import { enrichBlueskySnapshot, getPostThreadUrl, parseBlueskyThread } from './bluesky';
import { enrichSnapshot } from './index';

const DID = 'did:plc:z72i7hdynmk6r22z27h6tvur';

/** Shape of public.api.bsky.app getPostThread (observed 2026-09-29). */
const THREAD = {
  thread: {
    $type: 'app.bsky.feed.defs#threadViewPost',
    post: {
      uri: `at://${DID}/app.bsky.feed.post/3mv3shqdfuc2e`,
      author: { did: DID, handle: 'bsky.app', displayName: 'Bluesky' },
      record: {
        $type: 'app.bsky.feed.post',
        createdAt: '2026-09-09T15:00:07.513Z',
        langs: ['en'],
        text: 'Booth D-4 order form below',
        facets: [
          {
            features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://forms.example.org/d4' }],
            index: { byteStart: 0, byteEnd: 5 },
          },
        ],
      },
      embed: {
        $type: 'app.bsky.embed.recordWithMedia#view',
        media: {
          $type: 'app.bsky.embed.images#view',
          images: [
            {
              thumb: `https://cdn.bsky.app/img/feed_thumbnail/plain/${DID}/bafkimg@jpeg`,
              fullsize: `https://cdn.bsky.app/img/feed_fullsize/plain/${DID}/bafkimg@jpeg`,
              alt: 'Price list',
              aspectRatio: { height: 3000, width: 4000 },
            },
          ],
        },
      },
    },
  },
};

describe('getPostThreadUrl', () => {
  it('builds a handle-based AT-URI query', () => {
    expect(getPostThreadUrl({ actor: 'bsky.app', rkey: '3l6oveex3ii2l' })).toBe(
      'https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=at%3A%2F%2Fbsky.app%2Fapp.bsky.feed.post%2F3l6oveex3ii2l&depth=0&parentHeight=0'
    );
  });
});

describe('parseBlueskyThread', () => {
  it('reads text, language, author, images and links', () => {
    expect(parseBlueskyThread(THREAD)).toEqual({
      text: 'Booth D-4 order form below',
      lang: 'en',
      createdAt: '2026-09-09T15:00:07.513Z',
      author: { name: 'Bluesky', handle: 'bsky.app', did: DID },
      images: [
        { url: `https://cdn.bsky.app/img/feed_fullsize/plain/${DID}/bafkimg@jpeg`, alt: 'Price list' },
      ],
      links: ['https://forms.example.org/d4'],
    });
  });

  it('reads external link embeds', () => {
    const external = structuredClone(THREAD);
    external.thread.post.embed = {
      $type: 'app.bsky.embed.external#view',
      external: { uri: 'https://shop.example.com/' },
    } as never;
    expect(parseBlueskyThread(external)?.links).toEqual([
      'https://forms.example.org/d4',
      'https://shop.example.com/',
    ]);
  });

  it('returns null for not-found threads and bad payloads', () => {
    expect(
      parseBlueskyThread({ thread: { $type: 'app.bsky.feed.defs#notFoundPost', notFound: true } })
    ).toBeNull();
    expect(parseBlueskyThread(null)).toBeNull();
  });
});

describe('enrichBlueskySnapshot', () => {
  const dom = createSnapshot({
    site: 'bluesky',
    url: 'https://bsky.app/profile/bsky.app/post/3mv3shqdfuc2e',
    canonicalUrl: 'https://bsky.app/profile/bsky.app/post/3mv3shqdfuc2e',
    capturedAt: 1,
    text: 'Booth D-4 order form below',
    images: [{ url: `https://cdn.bsky.app/img/feed_thumbnail/plain/${DID}/bafkimg@jpeg` }],
  });

  it('replaces DOM data with the API copy', async () => {
    const fetchMock = vi.fn(async () => Response.json(THREAD));
    const result = await enrichBlueskySnapshot(dom, { fetch: fetchMock });
    expect(result).toMatchObject({
      text: 'Booth D-4 order form below',
      displayedText: null,
      lang: 'en',
      author: { name: 'Bluesky', handle: 'bsky.app', url: 'https://bsky.app/profile/bsky.app' },
      publishedAt: '2026-09-09T15:00:07.513Z',
      links: ['https://forms.example.org/d4'],
    });
    expect(result.images).toEqual([
      { url: `https://cdn.bsky.app/img/feed_fullsize/plain/${DID}/bafkimg@jpeg`, alt: 'Price list' },
    ]);
  });

  it('keeps page links (a right-clicked link first) ahead of API links', async () => {
    const fetchMock = vi.fn(async () => Response.json(THREAD));
    const clicked = createSnapshot({ ...dom, links: ['https://shop.example.com/d4'] });
    const result = await enrichBlueskySnapshot(clicked, { fetch: fetchMock });
    expect(result.links).toEqual(['https://shop.example.com/d4', 'https://forms.example.org/d4']);
  });

  it('keeps the DOM snapshot when the API fails', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 500 }));
    expect(await enrichBlueskySnapshot(dom, { fetch: fetchMock })).toBe(dom);
  });
});

describe('enrichSnapshot', () => {
  it('leaves generic snapshots alone and never throws', async () => {
    const fetchMock = vi.fn();
    const generic = createSnapshot({ url: 'https://e.com', capturedAt: 1 });
    expect(await enrichSnapshot(generic, { fetch: fetchMock })).toBe(generic);
    expect(fetchMock).not.toHaveBeenCalled();

    const throwing = vi.fn(() => {
      throw new Error('sync failure');
    });
    const bsky = createSnapshot({
      url: 'https://bsky.app/profile/a/post/b',
      capturedAt: 1,
    });
    expect(await enrichSnapshot(bsky, { fetch: throwing })).toBe(bsky);
  });
});
