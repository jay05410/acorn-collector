/**
 * Result of the on-demand readability extractor (extractor.ts) and how the
 * background merges it into a snapshot. Kept free of the defuddle import so
 * the background bundle stays small.
 */
import { markdownToPlainText } from './markdown';
import { normalizeSnapshot } from './snapshot';
import type { PageSnapshot } from './types';
import { isNullableString, isRecord } from './util';

export interface ReadableResult {
  title: string | null;
  /** Main content as Markdown. */
  text: string;
  author: string | null;
  published: string | null;
  image: string | null;
  lang: string | null;
}

/** executeScript results cross a process boundary; check their shape. */
export function isReadableResult(value: unknown): value is ReadableResult {
  return (
    isRecord(value) &&
    typeof value.text === 'string' &&
    isNullableString(value.title) &&
    isNullableString(value.author) &&
    isNullableString(value.published) &&
    isNullableString(value.image) &&
    isNullableString(value.lang)
  );
}

/**
 * Main content wins as `text`; text the content script found around the
 * right-clicked element is kept in front when the article does not already
 * contain it. The article is Markdown and the block text is plain DOM text,
 * so both are reduced to plain text before comparing. Metadata only fills
 * gaps.
 */
export function mergeReadable(
  snapshot: PageSnapshot,
  readable: ReadableResult
): PageSnapshot {
  const current = snapshot.text.trim();
  const main = readable.text.trim();
  let text = current;
  if (main) {
    text = !current || markdownToPlainText(main).includes(markdownToPlainText(current))
      ? main
      : `${current}\n\n${main}`;
  }
  return normalizeSnapshot({
    ...snapshot,
    text,
    title: snapshot.title || readable.title || '',
    author:
      snapshot.author ??
      (readable.author ? { name: readable.author, handle: null, url: null } : null),
    publishedAt: snapshot.publishedAt ?? readable.published,
    lang: snapshot.lang ?? readable.lang,
    images: readable.image
      ? [...snapshot.images, { url: readable.image }]
      : snapshot.images,
  });
}
