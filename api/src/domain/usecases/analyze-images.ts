import type { CreditRepository } from '../repositories/credit-repository';
import type { AnalysisResult, AnalysisItem } from '../entities/analysis';
import { getCreditCost } from '../../config/types';

export interface ImageAnalyzer {
  analyze(imageUrls: string[]): Promise<AnalysisItem[]>;
}

export class AnalyzeImagesUseCase {
  constructor(
    private creditRepository: CreditRepository,
    private imageAnalyzer: ImageAnalyzer
  ) {}

  async execute(userId: string, imageUrls: string[]): Promise<AnalysisResult> {
    const imageCount = Math.min(imageUrls.length, 4);
    const creditCost = getCreditCost(imageCount);

    const balance = await this.creditRepository.getBalance(userId);
    if (!balance || balance.balance < creditCost) {
      throw new InsufficientCreditsError(balance?.balance ?? 0, creditCost);
    }

    const items = await this.imageAnalyzer.analyze(imageUrls.slice(0, 4));

    await this.creditRepository.deductCredits(userId, creditCost);
    await this.creditRepository.createTransaction({
      userId,
      amount: -creditCost,
      type: 'usage',
      description: `Image analysis (${imageCount} images)`,
    });

    return {
      items,
      creditUsed: creditCost,
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
