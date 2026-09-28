import { GoogleGenAI, type Part } from '@google/genai';
import { appStorage } from './storage';
import { t, getLanguageForAI } from './i18n';

const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_IMAGES = 4;

export interface ImageAnalysisItem {
  name: string;
  price: number | null;
  category: string | null;
  options?: string[];
  confidence: number;
}

export interface ImageAnalysisResult {
  items: ImageAnalysisItem[];
  overallConfidence: number;
  tokenCount?: number;
}

export interface AnalysisOptions {
  onProgress?: (status: string) => void;
  signal?: AbortSignal;
}

const analysisCache = new Map<string, ImageAnalysisResult>();

function getCacheKey(imageUrls: string[]): string {
  return imageUrls.sort().join('|');
}

function getPrompt(imageCount: number, language?: string): string {
  const langName = language || getLanguageForAI();
  return `Extract UNIQUE products from ${imageCount} booth price list image(s).

[CRITICAL - NO DUPLICATES]
- Each product appears ONCE in output
- If same product shown multiple times, output it ONLY ONCE

[LAYOUT]
- Product name/price are NEAR each other spatially
- Ignore distant text (booth name, event name, artist name)

[NAME RULES]
- Use ONLY text directly next to product
- NEVER add distant prefixes (event/booth/artist name)

[OPTIONS vs SEPARATE]
- OPTIONS: Same product with variants (A,B,C) → single item with options array
- SEPARATE: Different product names → separate items

[FORMAT]
- name: Direct product text only
- price: Number (free=0, unknown=null)
- category: acrylic|keyring|stand|poster|postcard|sticker|photocard|memo|tape|badge|book|calendar|pouch|plush|apparel|other
- options: Array of variant names if applicable

[LANGUAGE]
- Return item names in ${langName}.
- If the text in the image is in a DIFFERENT language from ${langName}, format the name as: "Translated Name (Original Name)"
  Example: If image has "키링" and user language is English → "Keyring (키링)"
  Example: If image has "Keyring" and user language is Korean → "키링 (Keyring)"
- If the text is ALREADY in ${langName}, use the original text as-is.
- Category values must ALWAYS be in English (acrylic|keyring|...).
- Options should preserve the original text from the image.

[EXCLUDE]
Booth#, SNS, URL, shipping

JSON: {"items":[{"name":"string","price":number|null,"category":"string","options"?:["string"]}]}`;
}

async function fetchImageAsBase64(
  url: string
): Promise<{ data: string; mimeType: string }> {
  const response = await fetch(url);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce(
      (data, byte) => data + String.fromCharCode(byte),
      ''
    )
  );
  return { data: base64, mimeType: blob.type || 'image/jpeg' };
}

async function loadImages(
  imageUrls: string[],
  onProgress?: (loaded: number, total: number) => void
): Promise<Part[]> {
  const urls = imageUrls.slice(0, MAX_IMAGES).filter(Boolean);
  let loaded = 0;

  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const { data, mimeType } = await fetchImageAsBase64(url);
        loaded++;
        onProgress?.(loaded, urls.length);
        return { inlineData: { data, mimeType } } as Part;
      } catch (err) {
        console.error('[AI] Image load failed:', err);
        loaded++;
        onProgress?.(loaded, urls.length);
        return null;
      }
    })
  );

  return results.filter((p): p is Part => p !== null);
}

function parseResponse(text: string): ImageAnalysisItem[] {
  console.log('[AI] Raw response:', text);

  if (!text || text.trim() === '') {
    console.error('[AI] Empty response from model');
    return [];
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[AI] No JSON found in response');
    return [];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const rawItems = (parsed.items || []).map(
      (item: {
        name: string;
        price?: number | null;
        category?: string;
        options?: string[];
      }) => ({
        name: item.name,
        price: item.price ?? null,
        category: item.category || null,
        options: item.options?.length ? item.options : undefined,
        confidence: 95,
      })
    );

    const seen = new Set<string>();
    const items = rawItems.filter((item: ImageAnalysisItem) => {
      const dedupeKey = `${item.name}|${item.price}|${item.category}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    });

    console.log(
      '[AI] Parsed items:',
      rawItems.length,
      '→ unique:',
      items.length
    );
    return items;
  } catch (e) {
    console.error('[AI] JSON parse failed:', e, 'Text was:', jsonMatch[0]);
    return [];
  }
}

async function analyzeWithDirectApi(
  imageUrls: string[],
  apiKey: string,
  options?: AnalysisOptions
): Promise<ImageAnalysisResult> {
  options?.onProgress?.('5');
  const imageParts = await loadImages(imageUrls, (loaded, total) => {
    const percent = Math.round((loaded / total) * 30) + 5;
    options?.onProgress?.(String(percent));
  });

  if (imageParts.length === 0) {
    throw new Error(t('errors', 'imageLoadFailed'));
  }

  options?.onProgress?.('40');

  const langName = getLanguageForAI();
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [...imageParts, { text: getPrompt(imageParts.length, langName) }],
    config: {
      temperature: 0.1,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  });

  options?.onProgress?.('95');

  const items = parseResponse(response.text || '');
  options?.onProgress?.('100');

  return {
    items,
    overallConfidence: 95,
    tokenCount: response.usageMetadata?.totalTokenCount,
  };
}

export async function analyzeImages(
  imageUrls: string[],
  options?: AnalysisOptions
): Promise<ImageAnalysisResult | null> {
  if (!imageUrls?.length) return null;

  const cacheKey = getCacheKey(imageUrls);
  const cached = analysisCache.get(cacheKey);
  if (cached) {
    options?.onProgress?.('100');
    return cached;
  }

  const settings = await appStorage.getSettings();
  if (!settings.aiEnabled || !settings.geminiApiKey) {
    throw new NoAnalysisMethodError();
  }

  try {
    const result = await analyzeWithDirectApi(
      imageUrls,
      settings.geminiApiKey,
      options
    );

    analysisCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[AI] Analysis error:', error);

    if (
      error instanceof NoAnalysisMethodError ||
      error instanceof ApiKeyFailedError
    ) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';

    if (
      message.includes('API_KEY') ||
      message.includes('401') ||
      message.includes('403')
    ) {
      throw new ApiKeyFailedError();
    }
    if (message.includes('429')) {
      throw new Error(t('errors', 'rateLimitExceeded'));
    }
    if (message.includes('fetch') || message.includes('network')) {
      throw new Error(t('errors', 'networkError'));
    }

    throw new Error(message);
  }
}

export function cancelAnalysis(): void {
  analysisCache.clear();
}

export async function isAIEnabled(): Promise<boolean> {
  const settings = await appStorage.getSettings();
  return settings.aiEnabled && !!settings.geminiApiKey;
}

export async function testGeminiApiKey(
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  if (!apiKey.trim()) {
    return { success: false, error: t('settings', 'apiKeyInvalid') };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: 'test',
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (
      message.includes('401') ||
      message.includes('403') ||
      message.includes('API_KEY')
    ) {
      return { success: false, error: t('settings', 'apiKeyInvalid') };
    }
    if (message.includes('429')) {
      return { success: false, error: t('settings', 'apiKeyInvalid') };
    }
    return { success: false, error: message };
  }
}

export class NoAnalysisMethodError extends Error {
  constructor() {
    super(t('errors', 'noAnalysisMethod'));
    this.name = 'NoAnalysisMethodError';
  }
}

export class ApiKeyFailedError extends Error {
  constructor() {
    super(t('errors', 'apiKeyInvalid'));
    this.name = 'ApiKeyFailedError';
  }
}
