import { GoogleGenAI, type Part } from '@google/genai';
import { appStorage } from './storage';
import { t } from './i18n';
import { apiClient, ApiError } from './api-client';

const GEMINI_MODEL = 'gemini-2.0-flash-lite';
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
  creditUsed?: number;
  remainingCredits?: number;
}

export interface AnalysisOptions {
  onProgress?: (status: string) => void;
  signal?: AbortSignal;
  useProxy?: boolean;
}

const analysisCache = new Map<string, ImageAnalysisResult>();

function getCacheKey(imageUrls: string[]): string {
  return imageUrls.sort().join('|');
}

function getBaseInstruction(imageCount: number): string {
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

WRONG: "ORV 엽서" (ORV is distant booth name)
RIGHT: "엽서 세트" (actual product name)

[OPTIONS vs SEPARATE]
- OPTIONS: "키링 3000원 (A,B,C)" → {name:"키링", options:["A","B","C"]}
- SEPARATE: Different names → separate items

[FORMAT]
- name: Direct product text only
- price: Number (free=0, unknown=null)  
- category: acrylic|keyring|stand|poster|postcard|sticker|photocard|memo|tape|badge|book|calendar|pouch|plush|apparel|other

[EXCLUDE]
Booth#, SNS, URL, shipping

JSON: {"items":[{"name":"string","price":number|null,"category":"string","options"?:["string"]}]}`;
}

function getPrompt(imageCount: number): string {
  return getBaseInstruction(imageCount);
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
    throw new Error('이미지를 불러올 수 없습니다');
  }

  options?.onProgress?.('40');

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [...imageParts, { text: getPrompt(imageParts.length) }],
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

async function analyzeWithProxy(
  imageUrls: string[],
  options?: AnalysisOptions
): Promise<ImageAnalysisResult> {
  options?.onProgress?.('10');

  try {
    const response = await apiClient.analyzeImages(imageUrls);
    options?.onProgress?.('100');

    return {
      items: response.items.map((item) => ({ ...item, confidence: 95 })),
      overallConfidence: 95,
      creditUsed: response.creditUsed,
      remainingCredits: response.remainingCredits,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 402) {
        throw new InsufficientCreditsError(
          (error.data?.currentBalance as number) ?? 0,
          (error.data?.required as number) ?? 0
        );
      }
      if (error.status === 401) {
        throw new Error('로그인이 필요합니다');
      }
    }
    throw error;
  }
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
  const hasOwnApiKey = settings.aiEnabled && !!settings.geminiApiKey;

  try {
    let result: ImageAnalysisResult;

    if (hasOwnApiKey && !options?.useProxy) {
      result = await analyzeWithDirectApi(
        imageUrls,
        settings.geminiApiKey,
        options
      );
    } else {
      result = await analyzeWithProxy(imageUrls, options);
    }

    analysisCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[AI] Analysis error:', error);

    if (error instanceof InsufficientCreditsError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';

    if (
      message.includes('API_KEY') ||
      message.includes('401') ||
      message.includes('403')
    ) {
      throw new Error('API 키가 유효하지 않습니다');
    }
    if (message.includes('429')) {
      throw new Error('API 요청 한도 초과. 잠시 후 다시 시도해주세요');
    }
    if (message.includes('fetch') || message.includes('network')) {
      throw new Error('네트워크 오류. 인터넷 연결을 확인해주세요');
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

export async function canUseAI(): Promise<{
  enabled: boolean;
  method: 'direct' | 'proxy' | 'none';
}> {
  const settings = await appStorage.getSettings();

  if (settings.aiEnabled && settings.geminiApiKey) {
    return { enabled: true, method: 'direct' };
  }

  return { enabled: true, method: 'proxy' };
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

export class InsufficientCreditsError extends Error {
  constructor(
    public currentBalance: number,
    public required: number
  ) {
    super(`크레딧이 부족합니다. 현재: ${currentBalance}, 필요: ${required}`);
    this.name = 'InsufficientCreditsError';
  }
}
