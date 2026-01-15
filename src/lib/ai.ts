import { GoogleGenAI } from '@google/genai';
import { appStorage } from './storage';

const OCR_WORKER_URL =
  'https://acorn-ocr-proxy.acorn-collector.workers.dev/ocr';
const OCR_TIMEOUT_MS = 30000;
const GEMINI_MODEL = 'gemini-2.5-flash-lite';

export interface ImageAnalysisItem {
  name: string;
  price: number | null;
  category: string | null;
  confidence: number;
}

export interface ImageAnalysisResult {
  items: ImageAnalysisItem[];
  rawText?: string;
  overallConfidence: number;
  refinedByAI?: boolean;
}

export interface OCROptions {
  onProgress?: (status: string) => void;
  signal?: AbortSignal;
}

const imageAnalysisCache = new Map<string, ImageAnalysisResult>();

function getCacheKey(imageUrls: string[]): string {
  return imageUrls.sort().join('|');
}

const OCR_REFINE_PROMPT = `OCR→상품목록. 구매가능한 실제상품만 추출.

[필수제외-절대상품아님]
- 상품설명/소재설명("~입니다","~합니다","칼선","쉐이커")
- 사용법/주의사항("빼내","사용가능","고정된")
- 배송/이벤트/SNS/작가소개/부스위치

[카테고리-반드시1개선택]
아크릴|키링|스탠드|포스터|엽서|스티커|포토카드|메모지|테이프|배지|책|달력|파우치|인형|의류|기타

[가격]무료=0,불명=null

{"items":[{"name":"상품명만","price":숫자|null,"category":"필수"}]}
`;

let currentOCRController: AbortController | null = null;

export function cancelOCR(): void {
  if (currentOCRController) {
    currentOCRController.abort();
    currentOCRController = null;
  }
}

async function runOCRViaWorker(
  imageUrls: string[],
  options?: OCROptions
): Promise<ImageAnalysisResult> {
  const controller = new AbortController();
  currentOCRController = controller;

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, OCR_TIMEOUT_MS);

  if (options?.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  try {
    options?.onProgress?.('OCR 서버 연결 중...');

    const response = await fetch(OCR_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrls }),
      signal: controller.signal,
    });

    options?.onProgress?.('이미지 분석 중...');

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OCR 서버 오류: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'OCR 실패');
    }

    options?.onProgress?.('완료!');
    return data.result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OCR이 취소되었거나 시간 초과되었습니다');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    currentOCRController = null;
  }
}

async function refineWithAI(
  rawText: string,
  options?: OCROptions
): Promise<ImageAnalysisItem[]> {
  const settings = await appStorage.getSettings();

  if (!settings.aiEnabled || !settings.geminiApiKey) {
    return [];
  }

  options?.onProgress?.('AI로 결과 정제 중...');

  try {
    const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: OCR_REFINE_PROMPT + rawText,
      config: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    });

    const content = response.text || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    const items: ImageAnalysisItem[] = (parsed.items || []).map(
      (item: { name: string; price?: number | null; category?: string }) => ({
        name: item.name,
        price: item.price ?? null,
        category: item.category || null,
        confidence: 90,
      })
    );

    return items;
  } catch (error) {
    console.error('[AI Refine] Failed:', error);
    return [];
  }
}

export async function analyzeImages(
  imageUrls: string[],
  options?: OCROptions
): Promise<ImageAnalysisResult | null> {
  if (!imageUrls || imageUrls.length === 0) {
    return null;
  }

  const cacheKey = getCacheKey(imageUrls);
  const cached = imageAnalysisCache.get(cacheKey);
  if (cached) {
    options?.onProgress?.('캐시에서 불러옴');
    return cached;
  }

  try {
    const ocrResult = await runOCRViaWorker(imageUrls, options);

    const textForAI =
      ocrResult.rawText ||
      ocrResult.items.map((i) => `${i.name} ${i.price ?? ''}`).join('\n');

    if (textForAI) {
      const aiItems = await refineWithAI(textForAI, options);

      if (aiItems.length > 0) {
        const refinedResult: ImageAnalysisResult = {
          items: aiItems,
          rawText: ocrResult.rawText,
          overallConfidence: ocrResult.overallConfidence,
          refinedByAI: true,
        };
        imageAnalysisCache.set(cacheKey, refinedResult);
        return refinedResult;
      }
    }

    imageAnalysisCache.set(cacheKey, ocrResult);
    return ocrResult;
  } catch (error) {
    console.error('[Image Analysis] Failed:', error);
    throw error;
  }
}

export async function isAIEnabled(): Promise<boolean> {
  const settings = await appStorage.getSettings();
  return settings.aiEnabled && !!settings.geminiApiKey;
}

export async function testGeminiApiKey(
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  if (!apiKey.trim()) {
    return { success: false, error: 'API 키를 입력해주세요' };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: '테스트',
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    if (
      message.includes('401') ||
      message.includes('403') ||
      message.includes('API_KEY')
    ) {
      return { success: false, error: 'API 키가 유효하지 않습니다' };
    }
    if (message.includes('429')) {
      return { success: false, error: '요청 한도 초과 (키는 유효함)' };
    }
    return { success: false, error: message };
  }
}
