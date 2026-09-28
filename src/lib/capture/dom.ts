/**
 * DOM reading helpers for the content script. Read-only: nothing here mutates
 * the page.
 */
import type { CapturedImage } from './types';

const BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DD',
  'DIV',
  'DL',
  'DT',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'LI',
  'MAIN',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TR',
  'UL',
]);
const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG']);

/**
 * Text of an element with emoji images (`<img alt="😀">`, used by X) kept as
 * their alt text and line breaks preserved.
 */
export function readRichText(root: Element): string {
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.nodeValue ?? '');
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    const tag = element.tagName.toUpperCase();
    if (SKIPPED_TAGS.has(tag)) return;
    if (tag === 'BR') {
      parts.push('\n');
      return;
    }
    if (tag === 'IMG') {
      parts.push(element.getAttribute('alt') ?? '');
      return;
    }
    const block = BLOCK_TAGS.has(tag);
    if (block) parts.push('\n');
    for (const child of element.childNodes) walk(child);
    if (block) parts.push('\n');
  };
  walk(root);
  return parts.join('').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Rendered text of a generic page block. innerText follows CSS (hidden
 * elements skipped, whitespace collapsed, block breaks kept), unlike the raw
 * text-node walk that X's pre-wrap markup needs.
 */
export function readBlockText(element: Element): string {
  const text = element instanceof HTMLElement ? element.innerText : element.textContent;
  return (text ?? '').trim();
}

/** True when the element has a layout box intersecting the viewport. */
export function isInViewport(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const view = element.ownerDocument.defaultView;
  const viewHeight = view?.innerHeight ?? 0;
  const viewWidth = view?.innerWidth ?? 0;
  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < viewHeight &&
    rect.left < viewWidth
  );
}

interface SrcsetCandidate {
  url: string;
  width: number | null;
  density: number | null;
}

function parseSrcset(srcset: string): SrcsetCandidate[] {
  return srcset
    .split(/,\s+/)
    .map((entry) => entry.trim().split(/\s+/))
    .filter((parts) => parts[0])
    .map(([url = '', descriptor = '']) => {
      const width = /^(\d+)w$/i.exec(descriptor);
      const density = /^(\d+(?:\.\d+)?)x$/i.exec(descriptor);
      return {
        url,
        width: width ? Number(width[1]) : null,
        density: density ? Number(density[1]) : descriptor ? null : 1,
      };
    });
}

/** Largest candidate of a srcset, preferring width descriptors. */
export function bestSrcsetUrl(srcset: string | null): string | null {
  if (!srcset) return null;
  const candidates = parseSrcset(srcset);
  const byWidth = candidates
    .filter((c) => c.width !== null)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  if (byWidth[0]) return byWidth[0].url;
  const byDensity = candidates
    .filter((c) => c.density !== null)
    .sort((a, b) => (b.density ?? 0) - (a.density ?? 0));
  return byDensity[0]?.url ?? null;
}

const LAZY_SRC_ATTRIBUTES = ['data-src', 'data-original', 'data-lazy-src'];

/** Absolute http(s) URL, or null for other schemes and unparseable input. */
export function resolveHttpUrl(url: string, base: string): string | null {
  try {
    const resolved = new URL(url, base);
    return resolved.protocol === 'http:' || resolved.protocol === 'https:'
      ? resolved.href
      : null;
  } catch {
    return null;
  }
}

/**
 * Best URL for an <img>. Natural size is only reported when it belongs to the
 * chosen URL (a larger srcset candidate has an unknown size).
 */
export function imageFromElement(
  img: HTMLImageElement,
  baseUrl: string
): CapturedImage | null {
  const current = img.currentSrc || img.getAttribute('src') || '';
  const lazy = LAZY_SRC_ATTRIBUTES.map((name) => img.getAttribute(name)).find(
    (value): value is string => Boolean(value)
  );
  const fromSrcset = bestSrcsetUrl(img.getAttribute('srcset'));
  const chosen =
    fromSrcset ?? (current && !current.startsWith('data:') ? current : lazy);
  if (!chosen) return null;
  const url = resolveHttpUrl(chosen, baseUrl);
  if (!url) return null;

  const image: CapturedImage = { url };
  const sameAsLoaded = resolveHttpUrl(current, baseUrl) === url;
  if (sameAsLoaded && img.naturalWidth > 0) {
    image.width = img.naturalWidth;
    image.height = img.naturalHeight;
  }
  const alt = img.getAttribute('alt')?.trim();
  if (alt) image.alt = alt;
  return image;
}

export function collectImages(
  root: ParentNode,
  baseUrl: string,
  selector = 'img'
): CapturedImage[] {
  const images: CapturedImage[] = [];
  for (const img of root.querySelectorAll<HTMLImageElement>(selector)) {
    const image = imageFromElement(img, baseUrl);
    if (image) images.push(image);
  }
  return images;
}

/** Rendered images of at least `minSide` px that are currently on screen. */
export function largeImagesInView(
  doc: Document,
  baseUrl: string,
  minSide = 150,
  limit = 8
): CapturedImage[] {
  const visible: Array<{ image: CapturedImage; area: number }> = [];
  for (const img of doc.querySelectorAll<HTMLImageElement>('img')) {
    const rect = img.getBoundingClientRect();
    if (rect.width < minSide || rect.height < minSide) continue;
    if (!isInViewport(img)) continue;
    const image = imageFromElement(img, baseUrl);
    if (image) visible.push({ image, area: rect.width * rect.height });
  }
  return visible
    .sort((a, b) => b.area - a.area)
    .slice(0, limit)
    .map((entry) => entry.image);
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Absolute http(s) link targets under `root`. With `externalOnly`, links to
 * the page's own host (navigation, hashtags, profiles) are skipped.
 */
export function collectLinks(
  root: ParentNode,
  pageUrl: string,
  options: { externalOnly?: boolean; limit?: number } = {}
): string[] {
  const pageHost = hostOf(pageUrl);
  const limit = options.limit ?? 50;
  const links: string[] = [];
  for (const anchor of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const url = resolveHttpUrl(anchor.getAttribute('href') ?? '', pageUrl);
    if (!url) continue;
    if (options.externalOnly && hostOf(url) === pageHost) continue;
    links.push(url);
    if (links.length >= limit) break;
  }
  return links;
}

export function readSelection(win: Window): string | null {
  const text = win.getSelection()?.toString().trim();
  return text || null;
}

/** Element holding the current selection, used as the capture target. */
export function selectionTarget(win: Window): Element | null {
  const selection = win.getSelection();
  if (!selection || selection.isCollapsed) return null;
  const node = selection.anchorNode;
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : node.parentElement;
}
