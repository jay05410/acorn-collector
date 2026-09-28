import type { Placement } from './feed';

export const UTM_SOURCE = 'acorn-collector';
export const UTM_MEDIUM = 'sidepanel';

/**
 * Adds utm_source/utm_medium/utm_campaign to a sponsor link so the sponsor's
 * own analytics can attribute the visit; this is the only click signal that
 * exists. Parameters the sponsor already set win. The existing query and
 * fragment are kept byte-for-byte (no re-encoding). Non-http(s) URLs are
 * returned unchanged.
 */
export function withUtm(href: string, placement: Placement): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return href;

  const hashIndex = href.indexOf('#');
  const beforeHash = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : href.slice(hashIndex);

  const added = new URLSearchParams();
  const tags: [string, string][] = [
    ['utm_source', UTM_SOURCE],
    ['utm_medium', UTM_MEDIUM],
    ['utm_campaign', placement],
  ];
  for (const [key, value] of tags) {
    if (!url.searchParams.has(key)) added.set(key, value);
  }
  const extra = added.toString();
  if (!extra) return href;

  const separator = !beforeHash.includes('?')
    ? '?'
    : /[?&]$/.test(beforeHash)
      ? ''
      : '&';
  return `${beforeHash}${separator}${extra}${hash}`;
}

/**
 * Opens a link in a new browser tab. The side panel uses chrome.tabs (no
 * permission needed to create tabs); window.open is the fallback outside the
 * extension or if the call fails.
 */
export function openExternal(href: string): void {
  const fallback = () => {
    window.open(href, '_blank', 'noopener,noreferrer');
  };
  if (typeof chrome === 'undefined' || !chrome.tabs?.create) {
    fallback();
    return;
  }
  chrome.tabs.create({ url: href }).catch(fallback);
}
