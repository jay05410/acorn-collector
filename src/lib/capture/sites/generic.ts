/**
 * Minimal snapshot for any page: metadata (OpenGraph, JSON-LD, meta tags),
 * the text block around the right-clicked element, nearby and on-screen
 * images, and outbound links. The main article text is added later by the
 * on-demand extractor (defuddle) injected from the background.
 */
import {
  collectImages,
  collectLinks,
  imageFromElement,
  largeImagesInView,
  readBlockText,
  resolveHttpUrl,
} from '../dom';
import {
  readJsonLd,
  readMetaAuthor,
  readMetaDescription,
  readOpenGraph,
  summarizeJsonLd,
} from '../meta';
import { createSnapshot } from '../snapshot';
import type { CapturedImage, PageSnapshot, SiteId } from '../types';
import type { CaptureContext } from './context';

const MIN_BLOCK_TEXT = 40;
const MAX_BLOCK_TEXT = 20_000;
const MAX_BLOCK_DEPTH = 8;
const SEMANTIC_BLOCK = 'article, [role="article"], li, section, figure';

/**
 * Nearest ancestor of the target that reads as one content block: a semantic
 * container, or the first ancestor with enough text. Never <body>/<html>.
 */
export function findContentBlock(target: Element): Element | null {
  let current: Element | null = target;
  for (let depth = 0; current && depth < MAX_BLOCK_DEPTH; depth += 1) {
    const tag = current.tagName.toUpperCase();
    if (tag === 'BODY' || tag === 'HTML') return null;
    const length = current.textContent?.trim().length ?? 0;
    if (length > MAX_BLOCK_TEXT) return null;
    if (current.matches(SEMANTIC_BLOCK) || length >= MIN_BLOCK_TEXT) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function targetImage(target: Element | null, baseUrl: string): CapturedImage | null {
  const img = target?.closest('img');
  return img ? imageFromElement(img, baseUrl) : null;
}

function canonicalOf(doc: Document, og: Record<string, string>): string | null {
  const href = doc.querySelector('link[rel="canonical"]')?.getAttribute('href');
  return href || og['og:url'] || null;
}

function authorOf(
  doc: Document,
  og: Record<string, string>,
  ldAuthor: string | null
): PageSnapshot['author'] {
  // article:author is either a profile URL or a plain name.
  const articleAuthor = og['article:author'] ?? null;
  const authorIsUrl = articleAuthor !== null && /^https?:\/\//i.test(articleAuthor);
  const name =
    ldAuthor ?? readMetaAuthor(doc) ?? (authorIsUrl ? null : articleAuthor);
  const url = authorIsUrl ? articleAuthor : null;
  const handle = og['twitter:creator']?.replace(/^@/, '') || null;
  return name || url || handle ? { name, handle, url } : null;
}

function absoluteImages(urls: readonly string[], base: string): CapturedImage[] {
  return urls
    .map((url) => resolveHttpUrl(url, base))
    .filter((url): url is string => url !== null)
    .map((url) => ({ url }));
}

function uniqueTexts(texts: ReadonlyArray<string | null | undefined>): string {
  const kept: string[] = [];
  for (const text of texts) {
    const trimmed = text?.trim();
    if (!trimmed) continue;
    if (kept.some((existing) => existing.includes(trimmed))) continue;
    kept.push(trimmed);
  }
  return kept.join('\n\n');
}

export function buildGenericSnapshot(
  ctx: CaptureContext,
  site: SiteId
): PageSnapshot {
  const { doc, url, target } = ctx;
  const og = readOpenGraph(doc);
  const jsonLd = readJsonLd(doc);
  const ld = summarizeJsonLd(jsonLd);
  const block = target ? findContentBlock(target) : null;
  const description =
    og['og:description'] ?? readMetaDescription(doc) ?? ld.description;

  const images: CapturedImage[] = [];
  const clicked = targetImage(target, url);
  if (clicked) images.push(clicked);
  if (block) images.push(...collectImages(block, url));
  const ogImage = og['og:image:secure_url'] ?? og['og:image'];
  images.push(...absoluteImages(ogImage ? [ogImage, ...ld.images] : ld.images, url));
  images.push(...largeImagesInView(doc, url));

  const linkRoot = block ?? doc.body;
  const links = linkRoot
    ? collectLinks(linkRoot, url, { externalOnly: !block })
    : [];

  return createSnapshot({
    site,
    capturedAt: ctx.now,
    url,
    canonicalUrl: canonicalOf(doc, og),
    title: og['og:title'] ?? ld.title ?? doc.title,
    lang: doc.documentElement.getAttribute('lang') || ld.lang,
    author: authorOf(doc, og, ld.author),
    text: uniqueTexts([block ? readBlockText(block) : null, description]),
    selection: ctx.selection,
    images,
    links,
    publishedAt: og['article:published_time'] ?? ld.publishedAt,
    structured: { jsonLd, openGraph: og },
  });
}
