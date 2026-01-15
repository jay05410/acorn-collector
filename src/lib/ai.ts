import { appStorage, type AIProvider } from './storage';
import type { ParsedBooth } from '@/types';

const OCR_WORKER_URL =
  'https://acorn-ocr-proxy.acorn-collector.workers.dev/ocr';
const OCR_TIMEOUT_MS = 30000;

interface AIParseResult {
  boothNumber?: string;
  circleName?: string;
  eventHint?: string;
  zone?: string;
  items?: Array<{ name: string; price?: number }>;
}

export interface ImageAnalysisItem {
  name: string;
  price: number | null;
}

export interface ImageAnalysisResult {
  items: ImageAnalysisItem[];
  rawText?: string;
}

const imageAnalysisCache = new Map<string, ImageAnalysisResult>();

function getCacheKey(imageUrls: string[]): string {
  return imageUrls.sort().join('|');
}

const SYSTEM_PROMPT = `You are a parser for Korean doujin/fan event booth information.
Extract booth information from the given text. Return JSON only, no explanation.

JSON schema:
{
  "boothNumber": "string (e.g., A-01, C18)",
  "circleName": "string (circle/artist name)",
  "eventHint": "string (event name like 서코, 코믹월드, 디페스타)",
  "zone": "string (zone name like 쁘띠존, 프리존)",
  "items": [{"name": "string", "price": number or null}]
}

Rules:
- boothNumber: Extract patterns like A-01, C18, B12 etc.
- circleName: The artist or circle name, not Twitter handle
- eventHint: Common events: 서코, 서울코믹월드, 코믹월드, 디페스타, 동네페스타, 디페, 일러스타, 아이소, 부스데이즈
- items: Product names with prices if mentioned (e.g., "아크릴 3000원" -> {name: "아크릴", price: 3000})
- Return only the fields you can confidently extract
- If unsure, omit the field`;

async function callGemini(
  apiKey: string,
  text: string
): Promise<AIParseResult> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: `${SYSTEM_PROMPT}\n\nText to parse:\n${text}` }] },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error('[Gemini] Error response:', errorBody);
    throw new Error(`Gemini API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
}

async function callOpenAI(
  apiKey: string,
  text: string
): Promise<AIParseResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
}

async function callAnthropic(
  apiKey: string,
  text: string
): Promise<AIParseResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text || '{}';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
}

export async function parseWithAI(text: string): Promise<ParsedBooth | null> {
  const settings = await appStorage.getSettings();

  if (!settings.aiEnabled) {
    return null;
  }

  const apiKey = getApiKey(settings.aiProvider, settings);
  if (!apiKey) {
    return null;
  }

  try {
    const result = await callProvider(settings.aiProvider, apiKey, text);
    return {
      boothNumber: result.boothNumber,
      circleName: result.circleName,
      eventHint: result.eventHint,
      zone: result.zone,
      confidence: 0.9,
    };
  } catch (error) {
    console.error('AI parsing failed:', error);
    return null;
  }
}

function getApiKey(
  provider: AIProvider,
  settings: {
    geminiApiKey: string;
    openaiApiKey: string;
    anthropicApiKey: string;
  }
): string {
  switch (provider) {
    case 'gemini':
      return settings.geminiApiKey;
    case 'openai':
      return settings.openaiApiKey;
    case 'anthropic':
      return settings.anthropicApiKey;
  }
}

function callProvider(
  provider: AIProvider,
  apiKey: string,
  text: string
): Promise<AIParseResult> {
  switch (provider) {
    case 'gemini':
      return callGemini(apiKey, text);
    case 'openai':
      return callOpenAI(apiKey, text);
    case 'anthropic':
      return callAnthropic(apiKey, text);
  }
}

export async function isAIEnabled(): Promise<boolean> {
  const settings = await appStorage.getSettings();
  if (!settings.aiEnabled) return false;
  const apiKey = getApiKey(settings.aiProvider, settings);
  return !!apiKey;
}

export async function testApiKey(
  provider: AIProvider,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  if (!apiKey.trim()) {
    return { success: false, error: 'API 키를 입력해주세요' };
  }

  try {
    const testText = '테스트';
    await callProvider(provider, apiKey, testText);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    if (message.includes('401') || message.includes('403')) {
      return { success: false, error: 'API 키가 유효하지 않습니다' };
    }
    if (message.includes('429')) {
      return { success: false, error: '요청 한도 초과 (키는 유효함)' };
    }
    return { success: false, error: message };
  }
}

export interface OCROptions {
  onProgress?: (status: string) => void;
  signal?: AbortSignal;
}

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
    const result = await runOCRViaWorker(imageUrls, options);
    imageAnalysisCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[Image Analysis] Failed:', error);
    throw error;
  }
}

export function canAnalyzeImages(): boolean {
  return true;
}
