// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { buildBlueskySnapshot, parseBlueskyPostUrl } from './bluesky';
import type { CaptureContext } from './context';

const FEED = `
<div data-testid="feedItem-by-alice.bsky.social" id="item">
  <a href="/profile/alice.bsky.social" aria-label="Alice"><img src="https://cdn.bsky.app/img/avatar_thumbnail/plain/did:plc:a/bafyav@jpeg"></a>
  <a href="/profile/alice.bsky.social/post/3lxyzabc" id="time">2h</a>
  <div data-testid="postText" id="text">Booth C-3 this weekend! <a href="https://forms.example.org/pre">preorder</a></div>
  <img src="https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:a/bafyimg1@jpeg" alt="Price list">
</div>
<div data-testid="feedItem-by-bob.bsky.social">
  <a href="/profile/bob.bsky.social/post/3lbob">1h</a>
  <div data-testid="postText">Other post</div>
</div>`;

function context(overrides: Partial<CaptureContext>): CaptureContext {
  return {
    doc: document,
    url: 'https://bsky.app/',
    target: null,
    selection: null,
    now: 1,
    ...overrides,
  };
}

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('parseBlueskyPostUrl', () => {
  it('parses handle and DID post URLs', () => {
    expect(parseBlueskyPostUrl('https://bsky.app/profile/a.bsky.social/post/3k2')).toEqual({
      actor: 'a.bsky.social',
      rkey: '3k2',
    });
    expect(parseBlueskyPostUrl('/profile/did:plc:abc/post/3k2', 'https://bsky.app/')).toEqual({
      actor: 'did:plc:abc',
      rkey: '3k2',
    });
    expect(parseBlueskyPostUrl('https://bsky.app/profile/a.bsky.social')).toBeNull();
    expect(parseBlueskyPostUrl('https://example.com/profile/a/post/1')).toBeNull();
  });
});

describe('buildBlueskySnapshot', () => {
  it('captures the feed post under the right-clicked element', () => {
    document.body.innerHTML = FEED;
    const snapshot = buildBlueskySnapshot(context({ target: document.getElementById('text') }));
    expect(snapshot).toMatchObject({
      site: 'bluesky',
      url: 'https://bsky.app/profile/alice.bsky.social/post/3lxyzabc',
      text: 'Booth C-3 this weekend! preorder',
      author: {
        handle: 'alice.bsky.social',
        url: 'https://bsky.app/profile/alice.bsky.social',
      },
      links: ['https://forms.example.org/pre'],
    });
    expect(snapshot?.images).toEqual([
      {
        url: 'https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:a/bafyimg1@jpeg',
        alt: 'Price list',
      },
    ]);
  });

  it('uses the page URL and og:description on a post page without a target', () => {
    document.head.innerHTML =
      '<title>Alice on Bluesky</title><meta property="og:description" content="Thread text">';
    document.body.innerHTML = '<div data-testid="postThreadItem-by-alice.bsky.social"></div>';
    const snapshot = buildBlueskySnapshot(
      context({ url: 'https://bsky.app/profile/alice.bsky.social/post/3lpage' })
    );
    expect(snapshot).toMatchObject({
      url: 'https://bsky.app/profile/alice.bsky.social/post/3lpage',
      title: 'Alice on Bluesky',
      text: 'Thread text',
    });
  });

  it('returns null when there is no post to capture', () => {
    document.body.innerHTML = '<p>Settings</p>';
    expect(buildBlueskySnapshot(context({ url: 'https://bsky.app/settings' }))).toBeNull();
  });
});
