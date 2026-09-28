/**
 * Minimal bridge from a capture handoff to the existing AddBoothModal props,
 * until the capture review UI (ACORN-7) replaces it.
 */
import type { CaptureHandoff, PageSnapshot } from './types';

/**
 * Snapshot links appended to the text so the booth parser offers them as
 * form URLs. The right-clicked link comes first; past a few it is noise.
 */
export const MAX_PREFILL_LINKS = 5;

export interface AddBoothPrefill {
  /** Text for parseBoothText: the captured text plus links it does not contain. */
  text: string;
  url: string;
  /** "name @handle", from which parseBoothText takes the circle name. */
  author?: string;
  imageUrls?: string[];
}

function authorLabel(author: PageSnapshot['author']): string | undefined {
  if (!author) return undefined;
  const handle = author.handle ? `@${author.handle.replace(/^@/, '')}` : null;
  const label = [author.name, handle].filter(Boolean).join(' ');
  return label || undefined;
}

export function prefillFromHandoff(handoff: CaptureHandoff): AddBoothPrefill {
  const { snapshot } = handoff;
  const body = snapshot.text || snapshot.selection || '';
  const links = snapshot.links
    .filter((link) => !body.includes(link))
    .slice(0, MAX_PREFILL_LINKS);
  const images = snapshot.images.map((image) => image.url);
  return {
    text: [body, links.join('\n')].filter(Boolean).join('\n\n'),
    url: snapshot.canonicalUrl ?? snapshot.url,
    author: authorLabel(snapshot.author),
    imageUrls: images.length ? images : undefined,
  };
}
