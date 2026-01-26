import { Hono } from 'hono';
import type { Env } from '../../config/types';
import type { AuthContext } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { D1CreditRepository } from '../../infrastructure/database/d1-credit-repository';

const credits = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();

credits.use('/*', authMiddleware);

credits.get('/balance', async (c) => {
  const auth = c.get('auth');
  const creditRepo = new D1CreditRepository(c.env.DB);
  const balance = await creditRepo.getBalance(auth.userId);

  return c.json({
    balance: balance?.balance ?? 0,
    updatedAt: balance?.updatedAt ?? null,
  });
});

credits.get('/transactions', async (c) => {
  const auth = c.get('auth');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const creditRepo = new D1CreditRepository(c.env.DB);
  const transactions = await creditRepo.getTransactions(auth.userId, limit);

  return c.json({ transactions });
});

export { credits };
