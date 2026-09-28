// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { enrichXSnapshot } from '../enrich/x';
import type { CaptureContext } from './context';
import { buildXSnapshot, findTweetArticle, parseXStatusId, xStatusUrl } from './x';

/*
 * Fixture: trimmed copy of X's rendered timeline markup (data-testid hooks
 * as of 2026-09-29): two posts, the second one quoting a third, with X's
 * auto-translation applied to the first post's body.
 */

function userName(name: string, handle: string, id: string, datetime: string): string {
  return `
  <div data-testid="User-Name">
    <div><a href="/${handle}" role="link"><div dir="ltr"><span><span>${name}</span></span></div></a></div>
    <div>
      <a href="/${handle}" role="link" tabindex="-1"><div dir="ltr"><span>@${handle}</span></div></a>
      <div aria-hidden="true"><span>·</span></div>
      <a href="/${handle}/status/${id}" role="link" aria-label="${datetime}"><time datetime="${datetime}">Sep 28</time></a>
    </div>
  </div>`;
}

/** First post: English original, displayed in Korean (X auto-translate). */
const TRANSLATED_POST_ID = '1971234567890123456';
/** Second post: Japanese, untranslated, quotes another post. */
const QUOTING_POST_ID = '1971234567890999999';

const X_TIMELINE_HTML = `<!doctype html>
<html lang="ko"><head><title>홈 / X</title></head><body>
<main role="main"><div aria-label="Timeline: Your Home Timeline">
  <div data-testid="cellInnerDiv">
    <article aria-labelledby="id1" role="article" tabindex="0" data-testid="tweet">
      <div>
        <div><a href="/moonlit_circle" role="link"><img alt="" src="https://pbs.twimg.com/profile_images/111/avatar_normal.jpg"></a></div>
        ${userName('Moonlit <img alt="🌙" src="https://abs-0.twimg.com/emoji/v2/svg/1f319.svg"> Circle', 'moonlit_circle', TRANSLATED_POST_ID, '2026-09-28T09:30:00.000Z')}
        <div lang="ko" dir="auto" data-testid="tweetText" id="t1"><span>코믹마켓 부스 A-12에서 만나요! 아크릴 스탠드 1500엔 </span><img alt="✨" src="https://abs-0.twimg.com/emoji/v2/svg/2728.svg"><span>
통판: </span><a dir="ltr" href="https://t.co/AbCdEf1234" rel="noopener noreferrer nofollow" target="_blank" role="link"><span aria-hidden="true">https://</span>booth.pm/ja/items/88<span aria-hidden="true">93147</span><span aria-hidden="true">…</span></a></div>
        <div data-testid="tweetPhoto">
          <img alt="Price list" draggable="true" src="https://pbs.twimg.com/media/GAbCdEfXYZ1?format=jpg&amp;name=small">
        </div>
        <div data-testid="tweetPhoto">
          <img alt="Booth map" draggable="true" src="https://pbs.twimg.com/media/GAbCdEfXYZ2?format=png&amp;name=small">
        </div>
        <div role="group"><button data-testid="reply" aria-label="3 Replies"></button></div>
      </div>
    </article>
  </div>
  <div data-testid="cellInnerDiv">
    <article aria-labelledby="id2" role="article" tabindex="0" data-testid="tweet">
      <div>
        ${userName('星屋', 'hoshiya_doujin', QUOTING_POST_ID, '2026-09-28T11:00:00.000Z')}
        <div lang="ja" dir="auto" data-testid="tweetText" id="t2"><span>新刊サンプルです！</span></div>
        <div data-testid="tweetPhoto"><img alt="Image" src="https://pbs.twimg.com/media/GJpSample01?format=webp&amp;name=medium"></div>
        <div role="link" tabindex="0" id="quote">
          <div data-testid="User-Name">
            <div><span>Quoted Person</span></div><div><span>@quoted_person</span></div>
            <div><time datetime="2026-09-20T00:00:00.000Z">Sep 20</time></div>
          </div>
          <div lang="en" dir="auto" data-testid="tweetText"><span>Quoted post text</span></div>
        </div>
        <div data-testid="card.wrapper"><a href="https://t.co/CardLink99" role="link">example.com</a></div>
      </div>
    </article>
  </div>
</div></main>
</body></html>`;

const DISPLAYED_KO =
  '코믹마켓 부스 A-12에서 만나요! 아크릴 스탠드 1500엔 ✨\n통판: https://booth.pm/ja/items/8893147…';
const ORIGINAL_EN =
  'See you at Comiket booth A-12! Acrylic stands 1500 yen ✨\nMail order: https://t.co/AbCdEf1234 https://t.co/MediaLink1';

function loadTimeline(): Document {
  document.documentElement.innerHTML = X_TIMELINE_HTML.replace(/^<!doctype html>\s*/i, '');
  return document;
}

function context(overrides: Partial<CaptureContext> = {}): CaptureContext {
  return {
    doc: document,
    url: 'https://x.com/home',
    target: null,
    selection: null,
    now: 1_790_000_000_000,
    ...overrides,
  };
}

function article(index: number): HTMLElement {
  const found = document.querySelectorAll<HTMLElement>('article[data-testid="tweet"]')[index];
  if (!found) throw new Error(`fixture has no article ${index}`);
  return found;
}

function stubRect(element: Element, rect: Partial<DOMRect>) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
}

afterEach(() => {
  document.documentElement.innerHTML = '';
});

describe('parseXStatusId', () => {
  it.each([
    ['https://x.com/user/status/123', '123'],
    ['https://twitter.com/user/statuses/123?s=20', '123'],
    ['https://mobile.x.com/i/web/status/123/photo/1', '123'],
    ['/user/status/42', '42'],
    ['https://x.com/user', null],
    ['https://example.com/user/status/1', null],
  ])('%s -> %s', (url, id) => {
    expect(parseXStatusId(url, 'https://x.com/home')).toBe(id);
  });
});

describe('findTweetArticle', () => {
  it('uses the post containing the right-clicked element', () => {
    loadTimeline();
    const photo = article(1).querySelector('img');
    expect(findTweetArticle(document, photo, 'https://x.com/home')).toBe(article(1));
  });

  it('on a status page picks the post with that id', () => {
    loadTimeline();
    const url = `https://x.com/hoshiya_doujin/status/${QUOTING_POST_ID}`;
    expect(findTweetArticle(document, null, url)).toBe(article(1));
  });

  it('otherwise picks the first visible post', () => {
    loadTimeline();
    stubRect(article(0), { top: -900, bottom: -100, height: 800, width: 600, right: 600 });
    stubRect(article(1), { top: 50, bottom: 650, height: 600, width: 600, right: 600 });
    expect(findTweetArticle(document, null, 'https://x.com/home')).toBe(article(1));
  });

  it('falls back to the first post without layout information', () => {
    loadTimeline();
    expect(findTweetArticle(document, null, 'https://x.com/home')).toBe(article(0));
  });

  it('returns null when the page has no posts', () => {
    document.body.innerHTML = '<main><p>Profile</p></main>';
    expect(findTweetArticle(document, null, 'https://x.com/user')).toBeNull();
  });
});

describe('buildXSnapshot', () => {
  it('reads author, text with emoji, photos, links and time of the target post', () => {
    loadTimeline();
    const snapshot = buildXSnapshot(context({ target: document.getElementById('t1') }));
    expect(snapshot).toMatchObject({
      site: 'x',
      url: xStatusUrl(TRANSLATED_POST_ID, 'moonlit_circle'),
      canonicalUrl: `https://x.com/moonlit_circle/status/${TRANSLATED_POST_ID}`,
      title: 'Moonlit 🌙 Circle (@moonlit_circle)',
      lang: 'ko',
      author: {
        name: 'Moonlit 🌙 Circle',
        handle: 'moonlit_circle',
        url: 'https://x.com/moonlit_circle',
      },
      text: DISPLAYED_KO,
      displayedText: null,
      publishedAt: '2026-09-28T09:30:00.000Z',
      links: ['https://t.co/AbCdEf1234'],
      capturedAt: 1_790_000_000_000,
    });
    expect(snapshot?.images).toEqual([
      { url: 'https://pbs.twimg.com/media/GAbCdEfXYZ1?format=jpg&name=orig', alt: 'Price list' },
      { url: 'https://pbs.twimg.com/media/GAbCdEfXYZ2?format=png&name=4096x4096', alt: 'Booth map' },
    ]);
  });

  it('ignores the quoted post when reading text and permalink', () => {
    loadTimeline();
    const snapshot = buildXSnapshot(context({ target: document.getElementById('quote') }));
    expect(snapshot?.canonicalUrl).toBe(`https://x.com/hoshiya_doujin/status/${QUOTING_POST_ID}`);
    expect(snapshot?.text).toBe('新刊サンプルです！');
    expect(snapshot?.author?.handle).toBe('hoshiya_doujin');
    expect(snapshot?.links).toEqual(['https://t.co/CardLink99']);
    expect(snapshot?.images.map((image) => image.url)).toEqual([
      'https://pbs.twimg.com/media/GJpSample01?format=webp&name=4096x4096',
    ]);
  });

  it('carries the selection', () => {
    loadTimeline();
    expect(buildXSnapshot(context({ selection: ' A-12 ' }))?.selection).toBe('A-12');
  });

  it('returns null without posts so the caller can fall back to generic', () => {
    document.body.innerHTML = '<p>nothing</p>';
    expect(buildXSnapshot(context())).toBeNull();
  });
});

describe('translated post end to end (DOM snapshot + syndication enrichment)', () => {
  it('keeps the original as text and the translation as displayedText', async () => {
    loadTimeline();
    const snapshot = buildXSnapshot(context({ target: document.getElementById('t1') }));
    if (!snapshot) throw new Error('no snapshot');

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      // The logged-out status page is requested in parallel; syndication wins.
      if (!String(input).startsWith('https://cdn.syndication.twimg.com/')) {
        return new Response('', { status: 404 });
      }
      expect(String(input)).toContain(`id=${TRANSLATED_POST_ID}`);
      return Response.json({
        __typename: 'Tweet',
        id_str: TRANSLATED_POST_ID,
        lang: 'en',
        created_at: '2026-09-28T09:30:00.000Z',
        display_text_range: [0, 88],
        text: ORIGINAL_EN,
        entities: {
          urls: [
            { url: 'https://t.co/AbCdEf1234', expanded_url: 'https://booth.pm/ja/items/8893147' },
          ],
          media: [{ url: 'https://t.co/MediaLink1' }],
        },
        user: { name: 'Moonlit 🌙 Circle', screen_name: 'moonlit_circle' },
        photos: [{ url: 'https://pbs.twimg.com/media/GAbCdEfXYZ1.jpg', width: 1536, height: 2048 }],
      });
    });

    const enriched = await enrichXSnapshot(snapshot, { fetch: fetchMock });
    const syndicationCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).startsWith('https://cdn.syndication.twimg.com/')
    );
    expect(syndicationCalls).toHaveLength(1);
    expect(enriched.text).toBe(
      'See you at Comiket booth A-12! Acrylic stands 1500 yen ✨\nMail order: https://booth.pm/ja/items/8893147'
    );
    expect(enriched.displayedText).toBe(DISPLAYED_KO);
    expect(enriched.lang).toBe('en');
    expect(enriched.links).toEqual(['https://booth.pm/ja/items/8893147']);
    expect(enriched.images[0]).toEqual({
      url: 'https://pbs.twimg.com/media/GAbCdEfXYZ1?format=jpg&name=orig',
      width: 1536,
      height: 2048,
      alt: 'Price list',
    });
    expect(enriched.images).toHaveLength(2);
  });
});
