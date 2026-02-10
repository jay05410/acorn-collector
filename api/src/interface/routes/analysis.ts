import { Hono } from 'hono';
import type { Env } from '../../config/types';
import type { AuthContext } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { D1CreditRepository } from '../../infrastructure/database/d1-credit-repository';
import { D1AnalysisRepository } from '../../infrastructure/database/d1-analysis-repository';
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
  const body = await c.req.json<{ imageUrls: string[]; language?: string }>();

  if (!body.imageUrls?.length) {
    return c.json({ error: 'Missing imageUrls' }, 400);
  }

  if (body.imageUrls.length > 4) {
    return c.json({ error: 'Maximum 4 images allowed' }, 400);
  }

  const creditRepo = new D1CreditRepository(c.env.DB);
  const analysisRepo = new D1AnalysisRepository(c.env.DB);
  const analyzer = new GeminiAnalyzer(c.env.GEMINI_API_KEY);
  const useCase = new AnalyzeImagesUseCase(creditRepo, analyzer, analysisRepo);

  try {
    const result = await useCase.execute(auth.userId, body.imageUrls, body.language);
    const balance = await creditRepo.getBalance(auth.userId);

    return c.json({
      items: result.items,
      creditUsed: result.creditUsed,
      remainingCredits: balance?.balance ?? 0,
      sessionId: result.sessionId,
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

analysis.get('/history', async (c) => {
  const auth = c.get('auth');
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const analysisRepo = new D1AnalysisRepository(c.env.DB);

  try {
    const sessions = await analysisRepo.getUserSessions(auth.userId, limit);
    return c.json({ sessions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch history';
    return c.json({ error: message }, 500);
  }
});

analysis.get('/session/:id', async (c) => {
  const auth = c.get('auth');
  const sessionId = c.req.param('id');
  const analysisRepo = new D1AnalysisRepository(c.env.DB);

  try {
    const session = await analysisRepo.getSession(sessionId);
    if (!session || session.userId !== auth.userId) {
      return c.json({ error: 'Session not found' }, 404);
    }
    return c.json({ session });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch session';
    return c.json({ error: message }, 500);
  }
});

export { analysis };
