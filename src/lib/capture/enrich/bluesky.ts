/**
 * Bluesky post data from the public AppView (no auth):
 * public.api.bsky.app/xrpc/app.bsky.feed.getPostThread. Handle-based AT-URIs
 * are accepted, so no separate handle resolution is needed.
 */
import { normalizeSnapshot } from '../snapshot';
import { type BlueskyPostRef, blueskyPostUrl, parseBlueskyPostUrl } from '../sites/bluesky';
import type { CapturedImage, PageSnapshot } from '../types';
import { isRecord } from '../util';
import { type EnrichDeps, fetchJson, stringOr } from './http';

export function getPostThreadUrl(ref: BlueskyPostRef): string {
  const uri = `at://${ref.actor}/app.bsky.feed.post/${ref.rkey}`;
  return `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0&parentHeight=0`;
}

export interface BlueskyPost {
  text: string;
  lang: string | null;
  createdAt: string | null;
  author: { name: string | null; handle: string | null; did: string | null };
  images: CapturedImage[];
  links: string[];
}

function imagesOfView(view: Record<string, unknown>): CapturedImage[] {
  const images = Array.isArray(view.images) ? view.images.filter(isRecord) : [];
  return images
    .map((image): CapturedImage | null => {
      const url = stringOr(image.fullsize) ?? stringOr(image.thumb);
      if (!url) return null;
      const alt = stringOr(image.alt);
      return alt ? { url, alt } : { url };
    })
    .filter((image): image is CapturedImage => image !== null);
}

/** Images of `app.bsky.embed.images#view`, including inside recordWithMedia. */
function embedImages(embed: unknown): CapturedImage[] {
  if (!isRecord(embed)) return [];
  if (embed.$type === 'app.bsky.embed.images#view') return imagesOfView(embed);
  if (embed.$type === 'app.bsky.embed.recordWithMedia#view') {
    return embedImages(embed.media);
  }
  return [];
}

function embedLinks(embed: unknown): string[] {
  if (!isRecord(embed)) return [];
  if (embed.$type === 'app.bsky.embed.external#view' && isRecord(embed.external)) {
    const uri = stringOr(embed.external.uri);
    return uri ? [uri] : [];
  }
  if (embed.$type === 'app.bsky.embed.recordWithMedia#view') {
    return embedLinks(embed.media);
  }
  return [];
}

/** Link facets (`app.bsky.richtext.facet#link`) of the post record. */
function facetLinks(record: Record<string, unknown>): string[] {
  const facets = Array.isArray(record.facets) ? record.facets.filter(isRecord) : [];
  const links: string[] = [];
  for (const facet of facets) {
    const features = Array.isArray(facet.features) ? facet.features.filter(isRecord) : [];
    for (const feature of features) {
      const uri = feature.$type === 'app.bsky.richtext.facet#link' ? stringOr(feature.uri) : null;
      if (uri) links.push(uri);
    }
  }
  return links;
}

/** Parse a getPostThread response; null for not-found/blocked threads. */
export function parseBlueskyThread(payload: unknown): BlueskyPost | null {
  if (!isRecord(payload) || !isRecord(payload.thread)) return null;
  const post = payload.thread.post;
  if (!isRecord(post) || !isRecord(post.record)) return null;
  const record = post.record;
  const text = typeof record.text === 'string' ? record.text : null;
  if (text === null) return null;

  const author = isRecord(post.author) ? post.author : {};
  const langs = Array.isArray(record.langs) ? record.langs : [];
  return {
    text,
    lang: stringOr(langs[0]),
    createdAt: stringOr(record.createdAt),
    author: {
      name: stringOr(author.displayName),
      handle: stringOr(author.handle),
      did: stringOr(author.did),
    },
    images: embedImages(post.embed),
    links: [...facetLinks(record), ...embedLinks(post.embed)],
  };
}

export async function fetchBlueskyPost(
  ref: BlueskyPostRef,
  deps: EnrichDeps
): Promise<BlueskyPost | null> {
  return parseBlueskyThread(await fetchJson(getPostThreadUrl(ref), deps));
}

export async function enrichBlueskySnapshot(
  snapshot: PageSnapshot,
  deps: EnrichDeps
): Promise<PageSnapshot> {
  const ref =
    parseBlueskyPostUrl(snapshot.canonicalUrl ?? '') ?? parseBlueskyPostUrl(snapshot.url);
  if (!ref) return snapshot;
  const post = await fetchBlueskyPost(ref, deps);
  if (!post) return snapshot;

  const handle = post.author.handle ?? snapshot.author?.handle ?? null;
  const url = blueskyPostUrl({ actor: handle ?? ref.actor, rkey: ref.rkey });
  return normalizeSnapshot({
    ...snapshot,
    url,
    canonicalUrl: url,
    text: post.text,
    displayedText: snapshot.text || null,
    lang: post.lang ?? snapshot.lang,
    author: {
      name: post.author.name ?? snapshot.author?.name ?? null,
      handle,
      url: `https://bsky.app/profile/${handle ?? post.author.did ?? ref.actor}`,
    },
    publishedAt: post.createdAt ?? snapshot.publishedAt,
    images: [...post.images, ...snapshot.images],
    // Page links first: a right-clicked link the capture put first stays first.
    links: [...snapshot.links, ...post.links],
  });
}
