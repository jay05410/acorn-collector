import { Hono } from 'hono';
import type { Env } from '../../config/types';
import { D1UserRepository } from '../../infrastructure/database/d1-user-repository';
import { D1CreditRepository } from '../../infrastructure/database/d1-credit-repository';
import { GoogleAuthProviderImpl } from '../../infrastructure/auth/google-auth';
import { AuthenticateUserUseCase } from '../../domain/usecases/authenticate-user';

const auth = new Hono<{ Bindings: Env }>();

auth.post('/login', async (c) => {
  const body = await c.req.json<{ idToken: string }>();

  if (!body.idToken) {
    return c.json({ error: 'Missing idToken' }, 400);
  }

  const userRepo = new D1UserRepository(c.env.DB);
  const creditRepo = new D1CreditRepository(c.env.DB);
  const googleAuth = new GoogleAuthProviderImpl(c.env.GOOGLE_CLIENT_ID);

  const useCase = new AuthenticateUserUseCase(userRepo, creditRepo, googleAuth);

  try {
    const result = await useCase.execute(body.idToken);
    const balance = await creditRepo.getBalance(result.user.id);

    return c.json({
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      credits: balance?.balance ?? 0,
      isNewUser: result.isNewUser,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Authentication failed';
    return c.json({ error: message }, 401);
  }
});

export { auth };
