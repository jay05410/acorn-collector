/**
 * Image URL helpers shared by the content script (DOM candidates) and the
 * background enrichment (API results). Everything here is pure string work so
 * it runs in any context.
 */
import type { CapturedImage } from './types';

export const MAX_IMAGES = 8;
/** Images smaller than this on either side are treated as icons/avatars. */
export const MIN_IMAGE_SIDE = 200;

function parseHttpUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

const TWIMG_MEDIA_PATH =
  /^\/media\/([A-Za-z0-9_-]+)(?:\.(jpe?g|png|webp|gif))?(?::[a-z0-9]+)?$/i;

/**
 * pbs.twimg.com: `name=orig` only exists for format=jpg (png/webp orig
 * return 404), while `name=4096x4096` works for every format.
 */
function upgradeTwimg(url: URL): string | null {
  const match = TWIMG_MEDIA_PATH.exec(url.pathname);
  if (!match) return null;
  const id = match[1];
  const rawFormat = (
    url.searchParams.get('format') ??
    match[2] ??
    'jpg'
  ).toLowerCase();
  const format = rawFormat === 'jpeg' ? 'jpg' : rawFormat;
  const name = format === 'jpg' ? 'orig' : '4096x4096';
  return `https://pbs.twimg.com/media/${id}?format=${format}&name=${name}`;
}

/** cdn.bsky.app feed thumbnails have a full-size sibling at the same path. */
function upgradeBsky(url: URL): string | null {
  if (!url.pathname.startsWith('/img/feed_thumbnail/')) return null;
  return `https://cdn.bsky.app${url.pathname.replace(
    '/img/feed_thumbnail/',
    '/img/feed_fullsize/'
  )}`;
}

/** booth.pximg.net: `/c/<size>/<shop>/i/<item>/<file>` -> `/<shop>/i/<item>/<file>`. */
const BOOTH_RESIZED_PATH = /^\/c\/[^/]+\/([^/]+\/i\/.+)$/;

function upgradeBoothPximg(url: URL): string | null {
  const match = BOOTH_RESIZED_PATH.exec(url.pathname);
  return match ? `https://booth.pximg.net/${match[1]}` : null;
}

/**
 * i.pximg.net: thumbnails map to the 1200px "master" JPEG, which always exists.
 * The true original's extension (jpg/png/gif) cannot be derived from a
 * thumbnail URL, so it is not guessed.
 */
const PIXIV_THUMB_PATH =
  /^(?:\/c\/[^/]+)?\/(?:img-master|custom-thumb)\/img\/((?:\d+\/){6})(\d+_p\d+)_(?:master|square|custom)1200\.(?:jpg|png)$/;

function upgradePixiv(url: URL): string | null {
  const match = PIXIV_THUMB_PATH.exec(url.pathname);
  if (!match) return null;
  return `https://i.pximg.net/img-master/img/${match[1]}${match[2]}_master1200.jpg`;
}

/** Return the best known resolution for an image URL (unchanged if unknown). */
export function upgradeImageUrl(url: string): string {
  const parsed = parseHttpUrl(url);
  if (!parsed) return url;
  let upgraded: string | null = null;
  switch (parsed.hostname) {
    case 'pbs.twimg.com':
      upgraded = upgradeTwimg(parsed);
      break;
    case 'cdn.bsky.app':
      upgraded = upgradeBsky(parsed);
      break;
    case 'booth.pximg.net':
      upgraded = upgradeBoothPximg(parsed);
      break;
    case 'i.pximg.net':
      upgraded = upgradePixiv(parsed);
      break;
  }
  return upgraded ?? parsed.href;
}

/** Query parameters that only select a size/encoding of the same image. */
const SIZE_PARAMS = new Set([
  'w',
  'h',
  'width',
  'height',
  'size',
  'resize',
  'quality',
  'q',
  'fit',
  'crop',
  'format',
  'fm',
  'auto',
  'dpr',
  'name',
]);

/** Stable identity for de-duplication (ignores size/format variants). */
export function imageKey(url: string): string {
  const parsed = parseHttpUrl(url);
  if (!parsed) return url;
  const kept = [...parsed.searchParams.entries()]
    .filter(([key]) => !SIZE_PARAMS.has(key.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = kept.length ? `?${new URLSearchParams(kept).toString()}` : '';
  return `${parsed.hostname.toLowerCase()}${parsed.pathname}${query}`;
}

const DECORATIVE_URL_PATTERNS: readonly RegExp[] = [
  // Avatars
  /^https?:\/\/pbs\.twimg\.com\/profile_images\//i,
  /^https?:\/\/cdn\.bsky\.app\/img\/avatar(?:_thumbnail)?\//i,
  /^https?:\/\/booth\.pximg\.net\/.*\/icon_image\//i,
  /^https?:\/\/i\.pximg\.net\/.*user-profile\//i,
  /^https?:\/\/(?:[^/]+\.)?gravatar\.com\//i,
  /\/avatars?\//i,
  // Emoji
  /^https?:\/\/abs(?:-\d+)?\.twimg\.com\/(?:emoji|hashflags)\//i,
  /\/(?:tw)?emoji\//i,
  // Icons, sprites, favicons, tracking pixels
  /favicon/i,
  /apple-touch-icon/i,
  /\/(?:icons?|sprites?)\//i,
  /\.(?:svg|ico)(?:[?#]|$)/i,
  /\/(?:pixel|spacer|blank)\.gif(?:[?#]|$)/i,
];

/** True for avatars, emoji, icons and images known to be too small. */
export function isDecorativeImage(image: CapturedImage): boolean {
  if (DECORATIVE_URL_PATTERNS.some((pattern) => pattern.test(image.url))) {
    return true;
  }
  const tooNarrow = image.width !== undefined && image.width < MIN_IMAGE_SIDE;
  const tooShort = image.height !== undefined && image.height < MIN_IMAGE_SIDE;
  return tooNarrow || tooShort;
}

function positive(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : undefined;
}

function cleanImage(image: CapturedImage): CapturedImage | null {
  const parsed = parseHttpUrl(image.url.trim());
  if (!parsed) return null;
  const result: CapturedImage = { url: upgradeImageUrl(parsed.href) };
  const width = positive(image.width);
  const height = positive(image.height);
  const alt = image.alt?.replace(/\s+/g, ' ').trim().slice(0, 500);
  if (width !== undefined) result.width = width;
  if (height !== undefined) result.height = height;
  if (alt) result.alt = alt;
  return result;
}

/**
 * Upgrade to the best resolution, drop decorative images and non-http URLs,
 * de-duplicate by normalized URL (first occurrence wins; later duplicates fill
 * in missing size/alt) and cap the list.
 */
export function filterImages(
  images: readonly CapturedImage[],
  limit: number = MAX_IMAGES
): CapturedImage[] {
  const byKey = new Map<string, CapturedImage>();
  for (const raw of images) {
    const image = cleanImage(raw);
    if (!image || isDecorativeImage(image)) continue;
    const key = imageKey(image.url);
    const existing = byKey.get(key);
    if (existing) {
      if (existing.width === undefined && image.width !== undefined) {
        existing.width = image.width;
      }
      if (existing.height === undefined && image.height !== undefined) {
        existing.height = image.height;
      }
      if (existing.alt === undefined && image.alt !== undefined) {
        existing.alt = image.alt;
      }
      continue;
    }
    byKey.set(key, image);
  }
  return [...byKey.values()].slice(0, limit);
}
