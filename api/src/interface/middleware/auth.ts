import { createMiddleware } from 'hono/factory';
import type { Env } from '../../config/types';
import { D1UserRepository } from '../../infrastructure/database/d1-user-repository';
import {
  createOAuthProvider,
  type OAuthUserInfo,
} from '../../infrastructure/auth/oauth-provider';

export interface AuthContext {
  userId: string;
  email: string;
}

async function resolveUser(
  env: Env,
  token: string
): Promise<OAuthUserInfo | null> {
  // Try Google first
  try {
    const google = createOAuthProvider(
      'google',
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET
    );
    if (google.verifyIdToken) {
      return await google.verifyIdToken(token);
    }
  } catch {
    // Not a Google ID token, try as access token
  }

  try {
    const google = createOAuthProvider(
      'google',
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET
    );
    return await google.getUserInfo(token);
  } catch {
    // Not a Google access token
  }

  // Try Twitter
  try {
    const twitter = createOAuthProvider(
      'twitter',
      env.TWITTER_CLIENT_ID,
      env.TWITTER_CLIENT_SECRET
    );
    return await twitter.getUserInfo(token);
  } catch {
    return null;
  }
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
    const userInfo = await resolveUser(c.env, token);
    if (!userInfo) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const providerId = `${userInfo.provider}:${userInfo.id}`;
    const userRepo = new D1UserRepository(c.env.DB);
    const user = await userRepo.findByGoogleId(providerId);

    if (!user) {
      return c.json({ error: 'User not found. Please sign up first.' }, 401);
    }

    c.set('auth', { userId: user.id, email: user.email });
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
});
