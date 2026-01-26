import { createMiddleware } from 'hono/factory';
import type { Env } from '../../config/types';
import { D1UserRepository } from '../../infrastructure/database/d1-user-repository';
import { GoogleAuthProviderImpl } from '../../infrastructure/auth/google-auth';

export interface AuthContext {
  userId: string;
  email: string;
}

export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization header' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const googleAuth = new GoogleAuthProviderImpl(c.env.GOOGLE_CLIENT_ID);
    const googleUser = await googleAuth.verifyToken(token);

    const userRepo = new D1UserRepository(c.env.DB);
    const user = await userRepo.findByGoogleId(googleUser.sub);

    if (!user) {
      return c.json({ error: 'User not found. Please sign up first.' }, 401);
    }

    c.set('auth', { userId: user.id, email: user.email });
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
});
