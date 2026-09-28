/**
 * AI extraction contracts (ACORN-3). Providers (ACORN-4, ACORN-6) implement
 * `AIProvider`; the engine normalizes their wire output into
 * `ExtractionResult`. Gemini is intentionally not supported.
 */
import type { AppLanguage } from '@/i18n/languages';
import type { CurrencyCode, ItemCategory } from '@/types';

export type ProviderId = 'openai' | 'anthropic' | 'openrouter' | 'cli';

/** 'fast' = default low-latency model; 'accurate' = slower, stronger model. */
export type ModelTier = 'fast' | 'accurate';

export interface ImageInput {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Base64 without the data: prefix. */
  base64: string;
  width: number;
  height: number;
  /** SHA-256 hex of the encoded bytes; used for the local cache key. */
  hash: string;
  sourceUrl?: string;
}

export interface ExtractionRequest {
  /** Post or page text in its original language. May be empty. */
  text: string;
  images: ImageInput[];
  /** Language to translate item names into. */
  targetLanguage: AppLanguage;
  tier: ModelTier;
  hints?: {
    /** Names of the user's existing events, to help match `eventName`. */
    eventNames?: string[];
    defaultCurrency?: CurrencyCode | null;
  };
  signal?: AbortSignal;
  /** Called with items as they stream in (best effort). */
  onPartial?: (partial: PartialExtraction) => void;
}

/**
 * Wire format every provider must return (compact keys keep output tokens,
 * and therefore latency, low). Matches WIRE_SCHEMA in ./schema.ts.
 */
export interface WireExtraction {
  booth: {
    number: string | null;
    circle: string | null;
    event: string | null;
    zone: string | null;
    mailOrder: boolean;
  };
  currency: string | null;
  items: Array<{
    name: string;
    orig: string | null;
    price: number | null;
    cat: ItemCategory;
    opts: string[];
  }>;
}

export interface ExtractedItem {
  name: string;
  originalName: string | null;
  price: number | null;
  category: ItemCategory;
  options: string[];
}

export interface ExtractedBooth {
  boothNumber: string | null;
  circleName: string | null;
  eventName: string | null;
  zone: string | null;
  isMailOrder: boolean;
}

export interface ExtractionMeta {
  provider: ProviderId;
  model: string;
  latencyMs: number;
  cached: boolean;
  inputTokens?: number;
  outputTokens?: number;
  /** Indices (into the requested images) of images that could not be loaded; absent when none. */
  skippedImages?: number[];
}

export interface ExtractionResult {
  booth: ExtractedBooth;
  currency: CurrencyCode | null;
  items: ExtractedItem[];
  meta: ExtractionMeta;
}

export interface PartialExtraction {
  items: ExtractedItem[];
}

export interface ProviderCallOptions {
  apiKey: string;
  model: string;
  signal?: AbortSignal;
  /** Raw streamed text so far (the engine parses partial items from it). */
  onText?: (textSoFar: string) => void;
}

export interface ProviderRawResult {
  wire: WireExtraction;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AIProvider {
  id: ProviderId;
  /** Default model per tier, see ./models.ts. */
  defaultModel(tier: ModelTier): string;
  /** Run one extraction call. Must throw AIError on failure. */
  extract(
    req: ExtractionRequest,
    opts: ProviderCallOptions
  ): Promise<ProviderRawResult>;
  /** Cheap credential check used by the settings screen. */
  testConnection(opts: Omit<ProviderCallOptions, 'onText'>): Promise<void>;
}

export type AIErrorCode =
  | 'not_configured'
  | 'auth'
  | 'rate_limit'
  | 'quota'
  | 'network'
  | 'timeout'
  | 'cancelled'
  | 'bad_response'
  | 'refused'
  | 'unavailable'
  | 'unknown';

export class AIError extends Error {
  constructor(
    public code: AIErrorCode,
    message: string,
    public provider?: ProviderId,
    public status?: number
  ) {
    super(message);
    this.name = 'AIError';
  }

  get retryable(): boolean {
    return (
      this.code === 'rate_limit' ||
      this.code === 'network' ||
      this.code === 'timeout' ||
      this.code === 'unavailable'
    );
  }
}
