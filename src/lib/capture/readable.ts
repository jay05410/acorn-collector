/**
 * Readability extraction with defuddle (core bundle, ~91 KB gzip). Imported
 * only by the on-demand `extractor` unlisted script, never by the always-on
 * content script or the background.
 */
import Defuddle from 'defuddle';
import { htmlToMarkdown } from './markdown';
import type { ReadableResult } from './readable-result';
import { MAX_TEXT_LENGTH, normalizeText } from './snapshot';

function orNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function absolute(url: string | null, base: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, base).href;
  } catch {
    return null;
  }
}

export function extractReadable(doc: Document, url: string): ReadableResult {
  // parse() works on an internal clone; the page is not modified. useAsync is
  // off so no third-party requests are made from the page.
  const result = new Defuddle(doc, { url, useAsync: false }).parse();
  return {
    title: orNull(result.title),
    // Snapshots keep at most MAX_TEXT_LENGTH chars; do not ship more over IPC.
    text: result.content
      ? normalizeText(htmlToMarkdown(result.content, doc), MAX_TEXT_LENGTH)
      : '',
    author: orNull(result.author),
    published: orNull(result.published),
    image: absolute(orNull(result.image), url),
    lang: orNull(result.language),
  };
}
