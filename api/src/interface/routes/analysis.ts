import { Hono } from 'hono';
import type { Env } from '../../config/types';
import type { AuthContext } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { D1CreditRepository } from '../../infrastructure/database/d1-credit-repository';
import { GeminiAnalyzer } from '../../infrastructure/external/gemini-analyzer';
import {
  AnalyzeImagesUseCase,
  InsufficientCreditsError,
} from '../../domain/usecases/analyze-images';
import { getCreditCost } from '../../config/types';

const analysis = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

analysis.use('/*', authMiddleware);

analysis.post('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json<{ imageUrls: string[] }>();

  if (!body.imageUrls?.length) {
    return c.json({ error: 'Missing imageUrls' }, 400);
  }

  if (body.imageUrls.length > 4) {
    return c.json({ error: 'Maximum 4 images allowed' }, 400);
  }

  const creditRepo = new D1CreditRepository(c.env.DB);
  const analyzer = new GeminiAnalyzer(c.env.GEMINI_API_KEY);
  const useCase = new AnalyzeImagesUseCase(creditRepo, analyzer);

  try {
    const result = await useCase.execute(auth.userId, body.imageUrls);
    const balance = await creditRepo.getBalance(auth.userId);

    return c.json({
      items: result.items,
      creditUsed: result.creditUsed,
      remainingCredits: balance?.balance ?? 0,
    });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return c.json(
        {
          error: 'Insufficient credits',
          currentBalance: error.currentBalance,
          required: error.required,
        },
        402
      );
    }

    const message = error instanceof Error ? error.message : 'Analysis failed';
    return c.json({ error: message }, 500);
  }
});

analysis.get('/cost', async (c) => {
  const imageCount = parseInt(c.req.query('images') || '1', 10);
  const cost = getCreditCost(imageCount);
  return c.json({ imageCount, creditCost: cost });
});

export { analysis };
