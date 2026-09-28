/**
 * Transitional stub (ACORN-3). The Gemini implementation was removed; the new
 * provider-based engine lands in ACORN-4 under src/lib/ai/ and replaces this
 * file. Until then analysis reports "not configured".
 */
import { t } from '@/i18n';

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
}

export interface AnalysisOptions {
  onProgress?: (status: string) => void;
  signal?: AbortSignal;
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

export async function analyzeImages(
  _imageUrls: string[],
  _options?: AnalysisOptions
): Promise<ImageAnalysisResult | null> {
  throw new NoAnalysisMethodError();
}

export function cancelAnalysis(): void {}

export async function isAIEnabled(): Promise<boolean> {
  return false;
}

export async function testGeminiApiKey(
  _apiKey: string
): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: t('errors', 'noAnalysisMethod') };
}
