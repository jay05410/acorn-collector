/**
 * Bluesky (bsky.app) post extraction. The web app renders React Native
 * testIDs as data-testid: `feedItem-by-<handle>` (feeds),
 * `postThreadItem-by-<handle>` (threads) and `postText` (feed post body).
 * The background replaces text and images with the public API's copy
 * (enrich/bluesky.ts), so the DOM pass only has to find the right post.
 */
import { collectImages, collectLinks, readRichText } from '../dom';
import { readMetaDescription, readOpenGraph } from '../meta';
import { createSnapshot } from '../snapshot';
import type { PageSnapshot } from '../types';
import type { CaptureContext } from './context';

const POST_CONTAINER =
  '[data-testid^="feedItem-by-"], [data-testid^="postThreadItem-by-"]';
const POST_PATH = /^\/profile\/([^/]+)\/post\/([A-Za-z0-9]+)\/?$/;

export interface BlueskyPostRef {
  /** Handle or DID. */
  actor: string;
  rkey: string;
}

export function parseBlueskyPostUrl(
  url: string,
  base?: string
): BlueskyPostRef | null {
  try {
    const parsed = new URL(url, base);
    if (parsed.hostname !== 'bsky.app') return null;
    const match = POST_PATH.exec(parsed.pathname);
    if (!match?.[1] || !match[2]) return null;
    return { actor: decodeURIComponent(match[1]), rkey: match[2] };
  } catch {
    return null;
  }
}

export function blueskyPostUrl(ref: BlueskyPostRef): string {
  return `https://bsky.app/profile/${ref.actor}/post/${ref.rkey}`;
}

function handleOf(container: Element): string | null {
  const testId = container.getAttribute('data-testid') ?? '';
  const handle = testId.replace(/^(?:feedItem|postThreadItem)-by-/, '');
  return handle && handle !== testId ? handle : null;
}

/** The container's own post link (its permalink by that author). */
function postRefIn(
  container: Element,
  handle: string | null,
  pageUrl: string
): BlueskyPostRef | null {
  const anchors = [
    ...(container.matches('a[href]') ? [container] : []),
    ...container.querySelectorAll('a[href*="/post/"]'),
  ];
  const refs = anchors
    .map((anchor) => parseBlueskyPostUrl(anchor.getAttribute('href') ?? '', pageUrl))
    .filter((ref): ref is BlueskyPostRef => ref !== null);
  return refs.find((ref) => ref.actor === handle) ?? refs[0] ?? null;
}

/** Snapshot of one post, or null when there is no post to capture. */
export function buildBlueskySnapshot(ctx: CaptureContext): PageSnapshot | null {
  const container = ctx.target?.closest(POST_CONTAINER) ?? null;
  const handle = container ? handleOf(container) : null;
  const pageRef = parseBlueskyPostUrl(ctx.url);
  let ref = container ? postRefIn(container, handle, ctx.url) : null;
  // A thread's focused post has no permalink of its own: it is the page.
  if (!ref && pageRef && (!container || pageRef.actor === handle)) {
    ref = pageRef;
  }
  if (!ref) return null;

  const onPostPage =
    pageRef !== null &&
    pageRef.rkey === ref.rkey &&
    pageRef.actor === ref.actor;
  const textElement = container?.querySelector('[data-testid="postText"]');
  const og = readOpenGraph(ctx.doc);
  const text = textElement
    ? readRichText(textElement)
    : onPostPage
      ? (og['og:description'] ?? readMetaDescription(ctx.doc) ?? '')
      : '';
  const url = blueskyPostUrl(ref);
  const authorHandle = handle ?? (ref.actor.startsWith('did:') ? null : ref.actor);

  return createSnapshot({
    site: 'bluesky',
    capturedAt: ctx.now,
    url,
    canonicalUrl: url,
    title: onPostPage ? ctx.doc.title : (authorHandle ?? ''),
    author: {
      name: null,
      handle: authorHandle,
      url: `https://bsky.app/profile/${authorHandle ?? ref.actor}`,
    },
    text,
    selection: ctx.selection,
    images: container
      ? collectImages(container, ctx.url, 'img[src*="cdn.bsky.app/img/feed_"]')
      : [],
    links: container
      ? collectLinks(container, ctx.url, { externalOnly: true })
      : [],
  });
}
