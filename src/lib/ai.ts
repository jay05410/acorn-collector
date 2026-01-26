import { GoogleGenAI, type Part } from '@google/genai';
import { appStorage } from './storage';
import { t } from './i18n';

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
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

function getPrompt(imageCount: number): string {
  const instruction = `Extract product list from ${imageCount} doujin/fan event booth image(s).

[PRODUCT NAME RULES - MOST IMPORTANT]
1. Product name MUST be SPECIFIC and DESCRIPTIVE
2. Product name must NEVER be just the category (sticker, keyring, postcard, etc.)
3. Include character names, design names, or descriptive modifiers in the product name

WRONG: name="스티커", category="sticker" (name is just category!)
WRONG: name="엽서", category="postcard" (name is just category!)
CORRECT: name="조각스티커 강민재&차주환", category="sticker"
CORRECT: name="강하성 폴라로이드", category="photocard"

[OPTIONS vs SEPARATE PRODUCTS - CRITICAL]
Use OPTIONS only when: ONE product name + multiple character/variant choices at SAME price
- "뿅뿅키링 3000원 (A, B, C, D)" → name="뿅뿅키링", options=["A","B","C","D"]

Create SEPARATE products when: Each variant has its OWN name written separately
- "가가 스티커 3000원" + "나나 스티커 3000원" → TWO separate products, NO options
  → {name:"가가 스티커", price:3000}
  → {name:"나나 스티커", price:3000}

[EXTRACT PER PRODUCT]
- name: SPECIFIC product name (MUST include character/design name if visible, NEVER just category)
- price: Number only (free=0, unknown=null)
- category: acrylic|keyring|stand|poster|postcard|sticker|photocard|memo|tape|badge|book|calendar|pouch|plush|apparel|other
- options: ONLY when single product has selectable variants listed together

[EXCLUDE]
- Booth numbers, SNS, URLs, shipping info
- Broken/garbled text

[FINAL CHECK]
- Is name DIFFERENT from category? If name="스티커" and category="sticker", FIX IT!
- Does name include the character/design identifier visible in image?

JSON only:
{"items":[{"name":"string","price":number|null,"category":"string","options":["string"]?}]}`;

  // Prompt Repetition: Repeating the prompt twice improves accuracy
  // Research: https://arxiv.org/abs/... (Google Research 2025)
  return `${instruction}\n\n---\n\n${instruction}`;
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

async function loadImages(imageUrls: string[]): Promise<Part[]> {
  const parts: Part[] = [];
  const urls = imageUrls.slice(0, MAX_IMAGES);

  for (const url of urls) {
    if (!url) continue;
    try {
      const { data, mimeType } = await fetchImageAsBase64(url);
      parts.push({ inlineData: { data, mimeType } });
    } catch (err) {
      console.error('[AI] Image load failed:', err);
    }
  }

  return parts;
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
    const items = (parsed.items || []).map(
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
    console.log('[AI] Parsed items:', items.length);
    return items;
  } catch (e) {
    console.error('[AI] JSON parse failed:', e, 'Text was:', jsonMatch[0]);
    return [];
  }
}

export async function analyzeImages(
  imageUrls: string[],
  options?: AnalysisOptions
): Promise<ImageAnalysisResult | null> {
  if (!imageUrls?.length) return null;

  const settings = await appStorage.getSettings();
  if (!settings.aiEnabled || !settings.geminiApiKey) {
    console.error('[AI] API key not configured');
    throw new Error(t('analysis', 'failed') + ': API 키가 설정되지 않았습니다');
  }

  const cacheKey = getCacheKey(imageUrls);
  const cached = analysisCache.get(cacheKey);
  if (cached) {
    options?.onProgress?.('100');
    return cached;
  }

  try {
    // Step 1: Download images (0-40%)
    options?.onProgress?.('10');
    const imageParts = await loadImages(imageUrls);
    options?.onProgress?.('40');

    if (imageParts.length === 0) {
      throw new Error('이미지를 불러올 수 없습니다');
    }

    // Step 2: AI Analysis (40-90%)
    options?.onProgress?.('50');

    const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [...imageParts, { text: getPrompt(imageParts.length) }],
      config: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    });

    options?.onProgress?.('90');

    // Step 3: Parse response (90-100%)
    const items = parseResponse(response.text || '');
    options?.onProgress?.('100');

    const result: ImageAnalysisResult = {
      items,
      overallConfidence: 95,
      tokenCount: response.usageMetadata?.totalTokenCount,
    };

    analysisCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[AI] Analysis error:', error);
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
