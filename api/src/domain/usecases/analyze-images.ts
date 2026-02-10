import type { CreditRepository } from '../repositories/credit-repository';
import type { AnalysisRepository } from '../repositories/analysis-repository';
import type { AnalysisResult, AnalysisItem } from '../entities/analysis';
import { getCreditCost, GEMINI_MODEL } from '../../config/types';

export interface ImageAnalyzer {
  analyze(imageUrls: string[], language?: string): Promise<AnalysisItem[]>;
}

export class AnalyzeImagesUseCase {
  constructor(
    private creditRepository: CreditRepository,
    private imageAnalyzer: ImageAnalyzer,
    private analysisRepository?: AnalysisRepository
  ) {}

  async execute(userId: string, imageUrls: string[], language?: string): Promise<AnalysisResult> {
    const imageCount = Math.min(imageUrls.length, 4);
    const creditCost = getCreditCost(imageCount);

    const balance = await this.creditRepository.getBalance(userId);
    if (!balance || balance.balance < creditCost) {
      throw new InsufficientCreditsError(balance?.balance ?? 0, creditCost);
    }

    const items = await this.imageAnalyzer.analyze(imageUrls.slice(0, 4), language);

    await this.creditRepository.deductCreditsWithTransaction(
      userId,
      creditCost,
      {
        userId,
        amount: -creditCost,
        type: 'usage',
        description: `Image analysis (${imageCount} images)`,
      }
    );

    // Save analysis session to DB
    const sessionId = crypto.randomUUID();
    if (this.analysisRepository) {
      try {
        await this.analysisRepository.saveSession(
          {
            id: sessionId,
            userId,
            method: 'credit',
            model: GEMINI_MODEL,
            creditCost,
            imageCount,
            itemCount: items.length,
            status: 'completed',
          },
          items,
          imageUrls.slice(0, 4)
        );
      } catch (err) {
        console.error('Failed to save analysis session:', err);
      }
    }

    return {
      items,
      creditUsed: creditCost,
      sessionId,
    };
  }
}

export class InsufficientCreditsError extends Error {
  constructor(
    public currentBalance: number,
    public required: number
  ) {
    super(`Insufficient credits: have ${currentBalance}, need ${required}`);
    this.name = 'InsufficientCreditsError';
  }
}
