/**
 * Page capture contracts (ACORN-3). The content script / injected extractor
 * (ACORN-5) returns a PageSnapshot built from the page the user is already
 * viewing. Nothing is fetched by or stored on a server we run.
 */
import type { ExtractedItem } from '@/lib/ai/types';

export type SiteId =
  | 'x'
  | 'bluesky'
  | 'booth'
  | 'instagram'
  | 'threads'
  | 'pixiv'
  | 'witchform'
  | 'generic';

export interface CapturedImage {
  /** Best available resolution URL (e.g. pbs.twimg.com ...&name=orig). */
  url: string;
  width?: number;
  height?: number;
  alt?: string;
}

export interface PageSnapshot {
  version: 1;
  capturedAt: number;
  site: SiteId;
  url: string;
  canonicalUrl: string | null;
  title: string;
  /** BCP 47 language of `text` if known. */
  lang: string | null;
  author: {
    name: string | null;
    handle: string | null;
    url: string | null;
  } | null;
  /** Main text in its ORIGINAL language, trimmed to <= 8000 chars. */
  text: string;
  /** Text as displayed in the DOM when it differs (e.g. auto-translated). */
  displayedText: string | null;
  /** User's text selection at capture time, if any. */
  selection: string | null;
  /** Deduped, best resolution first, at most 8. */
  images: CapturedImage[];
  /** Outbound links (order forms, info pages), deduped, at most 20. */
  links: string[];
  publishedAt: string | null;
  structured: {
    jsonLd: unknown[];
    openGraph: Record<string, string>;
  } | null;
  /**
   * Items read from a structured source without an LLM (e.g. BOOTH item
   * JSON). When present the UI can skip AI analysis.
   */
  prefilledItems: ExtractedItem[] | null;
  /** Currency of prefilledItems prices, if known. */
  prefilledCurrency: string | null;
}

export const CAPTURE_TRIGGERS = [
  'context-menu',
  'image-context-menu',
  'action',
  'shortcut',
  'panel-button',
] as const;

export type CaptureTrigger = (typeof CAPTURE_TRIGGERS)[number];

/**
 * Background -> side panel handoff, kept in chrome.storage.session under
 * CAPTURE_HANDOFF_KEY (memory only, never written to disk).
 */
export interface CaptureHandoff {
  id: string;
  trigger: CaptureTrigger;
  snapshot: PageSnapshot;
  /** For image-context-menu: the single image the user right-clicked. */
  focusImageUrl: string | null;
  createdAt: number;
  /**
   * Browser window of the captured tab. Side panels ignore handoffs for
   * other windows; null/absent means any window.
   */
  windowId?: number | null;
}

export const CAPTURE_HANDOFF_KEY = 'capture:pending';

/** Messages between background, content script and side panel. */
export type CaptureMessage =
  | { type: 'acorn:capture'; trigger: CaptureTrigger; focusImageUrl?: string | null }
  | { type: 'acorn:capture-result'; snapshot: PageSnapshot }
  | { type: 'acorn:capture-error'; message: string };
