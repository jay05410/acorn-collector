/**
 * X (Twitter) post extraction from the rendered DOM. The DOM text may be
 * auto-translated by X; the background replaces it with the original text
 * (see enrich/x.ts) and keeps this one as `displayedText`.
 */
import { collectLinks, isInViewport, readRichText } from '../dom';
import { createSnapshot } from '../snapshot';
import type { CapturedImage, PageSnapshot } from '../types';
import type { CaptureContext } from './context';

export const X_SELECTORS = {
  tweet: 'article[data-testid="tweet"]',
  text: '[data-testid="tweetText"]',
  userName: '[data-testid="User-Name"]',
  photo: '[data-testid="tweetPhoto"]',
  card: '[data-testid="card.wrapper"]',
} as const;

const X_HOSTS = new Set([
  'x.com',
  'www.x.com',
  'mobile.x.com',
  'twitter.com',
  'www.twitter.com',
  'mobile.twitter.com',
]);
const STATUS_PATH = /^\/(?:[A-Za-z0-9_]{1,15}|i(?:\/web)?)\/status(?:es)?\/(\d{1,20})(?:[/?#]|$)/;

/** Numeric status id from an x.com / twitter.com post URL. */
export function parseXStatusId(url: string, base?: string): string | null {
  try {
    const parsed = new URL(url, base);
    if (!X_HOSTS.has(parsed.hostname.toLowerCase())) return null;
    return STATUS_PATH.exec(parsed.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Canonical post URL; x.com redirects /i/status/<id> to the author's path. */
export function xStatusUrl(id: string, handle?: string | null): string {
  return `https://x.com/${handle ?? 'i'}/status/${id}`;
}

/** Quoted posts are rendered inside a clickable div[role="link"] card. */
function isInQuotedPost(element: Element, article: Element): boolean {
  const card = element.closest('div[role="link"]');
  return card !== null && article.contains(card);
}

/** The post's own permalink (a time element wrapped in a status link). */
function statusLink(article: Element): HTMLAnchorElement | null {
  for (const time of article.querySelectorAll('time')) {
    if (isInQuotedPost(time, article)) continue;
    const link = time.closest<HTMLAnchorElement>('a[href*="/status/"]');
    if (link && article.contains(link)) return link;
  }
  return null;
}

/** The post's own text element (not the text of a quoted post). */
function postTextElement(article: Element): Element | null {
  const candidates = [...article.querySelectorAll(X_SELECTORS.text)];
  return (
    candidates.find((element) => !isInQuotedPost(element, article)) ??
    candidates[0] ??
    null
  );
}

/**
 * Pick the post to capture: the one containing the right-clicked element,
 * else on /status/<id> pages the post with that id, else the first visible
 * post, else the first post.
 */
export function findTweetArticle(
  doc: Document,
  target: Element | null,
  pageUrl: string
): HTMLElement | null {
  const fromTarget = target?.closest<HTMLElement>(X_SELECTORS.tweet);
  if (fromTarget) return fromTarget;

  const articles = [...doc.querySelectorAll<HTMLElement>(X_SELECTORS.tweet)];
  if (!articles.length) return null;

  const statusId = parseXStatusId(pageUrl);
  if (statusId) {
    const match = articles.find((article) => {
      const href = statusLink(article)?.getAttribute('href');
      return href ? parseXStatusId(href, pageUrl) === statusId : false;
    });
    if (match) return match;
  }
  return articles.find(isInViewport) ?? articles[0] ?? null;
}

interface TweetAuthor {
  name: string | null;
  handle: string | null;
}

function readAuthor(article: Element): TweetAuthor {
  const block = article.querySelector(X_SELECTORS.userName);
  if (!block) return { name: null, handle: null };
  let handle: string | null = null;
  for (const element of block.querySelectorAll('span, a')) {
    const text = element.textContent?.trim() ?? '';
    const match = /^@([A-Za-z0-9_]{1,15})$/.exec(text);
    if (match) {
      handle = match[1] ?? null;
      break;
    }
  }
  const nameLink = block.querySelector('a');
  const name = nameLink ? readRichText(nameLink).trim() : '';
  return { name: name && !name.startsWith('@') ? name : null, handle };
}

function readPhotos(article: Element): CapturedImage[] {
  const photos: CapturedImage[] = [];
  const images = article.querySelectorAll<HTMLImageElement>(
    `${X_SELECTORS.photo} img`
  );
  for (const img of images) {
    const src = img.getAttribute('src') ?? '';
    if (!src.startsWith('https://pbs.twimg.com/media/')) continue;
    // DOM photos are downscaled variants; their natural size says nothing
    // about the original, so no size is reported.
    const alt = img.getAttribute('alt')?.trim();
    photos.push(alt ? { url: src, alt } : { url: src });
  }
  return photos;
}

/** Links in the post body and its link card (t.co until enrichment). */
function readLinks(article: Element, textElement: Element | null, pageUrl: string) {
  const links: string[] = [];
  if (textElement) {
    links.push(...collectLinks(textElement, pageUrl, { externalOnly: true }));
  }
  const card = article.querySelector(X_SELECTORS.card);
  if (card) links.push(...collectLinks(card, pageUrl, { externalOnly: true }));
  return links;
}

/** Snapshot of one post, or null when the page has no post to capture. */
export function buildXSnapshot(ctx: CaptureContext): PageSnapshot | null {
  const article = findTweetArticle(ctx.doc, ctx.target, ctx.url);
  if (!article) return null;

  const link = statusLink(article);
  const href = link?.getAttribute('href');
  const statusId = href ? parseXStatusId(href, ctx.url) : null;
  const author = readAuthor(article);
  const statusUrl = statusId ? xStatusUrl(statusId, author.handle) : null;
  const textElement = postTextElement(article);
  const text = textElement ? readRichText(textElement) : '';

  return createSnapshot({
    site: 'x',
    capturedAt: ctx.now,
    url: statusUrl ?? ctx.url,
    canonicalUrl: statusUrl,
    title: author.name
      ? `${author.name}${author.handle ? ` (@${author.handle})` : ''}`
      : ctx.doc.title,
    lang: textElement?.getAttribute('lang') ?? null,
    author:
      author.name || author.handle
        ? {
            name: author.name,
            handle: author.handle,
            url: author.handle ? `https://x.com/${author.handle}` : null,
          }
        : null,
    text,
    selection: ctx.selection,
    images: readPhotos(article),
    links: readLinks(article, textElement, ctx.url),
    publishedAt: link?.querySelector('time')?.getAttribute('datetime') ?? null,
  });
}
