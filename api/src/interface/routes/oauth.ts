import { Hono } from 'hono';
import type { Env } from '../../config/types';
import { D1UserRepository } from '../../infrastructure/database/d1-user-repository';
import { D1CreditRepository } from '../../infrastructure/database/d1-credit-repository';
import {
  createOAuthProvider,
  type ProviderType,
  type OAuthUserInfo,
} from '../../infrastructure/auth/oauth-provider';
import { SIGNUP_BONUS_CREDITS } from '../../config/pricing';

const oauth = new Hono<{ Bindings: Env }>();

function getProviderConfig(env: Env, provider: ProviderType) {
  if (provider === 'google') {
    return {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (provider === 'twitter') {
    return {
      clientId: env.TWITTER_CLIENT_ID,
      clientSecret: env.TWITTER_CLIENT_SECRET,
    };
  }
  throw new Error('Unknown provider');
}

function generateState(): string {
  return crypto.randomUUID();
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 64);
}

oauth.get('/:provider', async (c) => {
  const provider = c.req.param('provider') as ProviderType;
  const redirect = c.req.query('redirect') || '';

  if (!['google', 'twitter'].includes(provider)) {
    return c.json({ error: 'Invalid provider' }, 400);
  }

  const config = getProviderConfig(c.env, provider);
  const oauthProvider = createOAuthProvider(
    provider,
    config.clientId,
    config.clientSecret
  );

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const redirectUri = `${new URL(c.req.url).origin}/oauth/${provider}/callback`;

  const stateData = JSON.stringify({ state, redirect, codeVerifier });
  const encodedState = btoa(stateData);

  const authUrl = oauthProvider.getAuthUrl(redirectUri, encodedState, codeVerifier);
  return c.redirect(authUrl);
});

oauth.get('/:provider/callback', async (c) => {
  const provider = c.req.param('provider') as ProviderType;
  const code = c.req.query('code');
  const stateParam = c.req.query('state');
  const error = c.req.query('error');

  if (error || !code || !stateParam) {
    return c.json({ error: error || 'Missing code or state' }, 400);
  }

  let redirect = '';
  let codeVerifier = '';
  try {
    const stateData = JSON.parse(atob(stateParam));
    redirect = stateData.redirect || '';
    codeVerifier = stateData.codeVerifier || '';
  } catch {
    return c.json({ error: 'Invalid state' }, 400);
  }

  const config = getProviderConfig(c.env, provider);
  const oauthProvider = createOAuthProvider(
    provider,
    config.clientId,
    config.clientSecret
  );
  const redirectUri = `${new URL(c.req.url).origin}/oauth/${provider}/callback`;

  try {
    const tokens = await oauthProvider.exchangeCode(
      code,
      redirectUri,
      codeVerifier
    );
    const userInfo = await oauthProvider.getUserInfo(tokens.accessToken);

    const { user, credits } = await findOrCreateUser(c.env.DB, userInfo);

    const callbackData = encodeURIComponent(
      JSON.stringify({
        type: 'AUTH_SUCCESS',
        token: tokens.accessToken,
        user,
        credits,
      })
    );
    return c.redirect(`${redirect}#${callbackData}`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    const errorData = encodeURIComponent(
      JSON.stringify({ type: 'AUTH_ERROR', error: 'Authentication failed' })
    );
    return c.redirect(`${redirect}#${errorData}`);
  }
});

oauth.post('/verify', async (c) => {
  const body = await c.req.json<{ provider: ProviderType; token: string }>();

  if (!body.provider || !body.token) {
    return c.json({ error: 'Missing provider or token' }, 400);
  }

  const config = getProviderConfig(c.env, body.provider);
  const oauthProvider = createOAuthProvider(
    body.provider,
    config.clientId,
    config.clientSecret
  );

  try {
    let userInfo: OAuthUserInfo;

    if (body.provider === 'google' && oauthProvider.verifyIdToken) {
      userInfo = await oauthProvider.verifyIdToken(body.token);
    } else {
      userInfo = await oauthProvider.getUserInfo(body.token);
    }

    const { user, credits, isNewUser } = await findOrCreateUser(
      c.env.DB,
      userInfo
    );

    return c.json({ user, credits, isNewUser });
  } catch (err) {
    console.error('Token verification error:', err);
    return c.json({ error: 'Invalid token' }, 401);
  }
});

async function findOrCreateUser(db: D1Database, userInfo: OAuthUserInfo) {
  const userRepo = new D1UserRepository(db);
  const creditRepo = new D1CreditRepository(db);

  const oderId = `${userInfo.provider}:${userInfo.id}`;
  let user = await userRepo.findByGoogleId(oderId);
  let isNewUser = false;

  if (!user) {
    user = await userRepo.create({
      googleId: oderId,
      email: userInfo.email,
      name: userInfo.name,
    });

    const now = new Date().toISOString();
    const txId = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          'INSERT INTO credit_balances (user_id, balance, updated_at) VALUES (?, ?, ?)'
        )
        .bind(user.id, SIGNUP_BONUS_CREDITS, now),
      db
        .prepare(
          'INSERT INTO credit_transactions (id, user_id, amount, type, description, reference_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          txId,
          user.id,
          SIGNUP_BONUS_CREDITS,
          'bonus',
          'Signup bonus credits',
          null,
          now
        ),
    ]);
    isNewUser = true;
  }

  const balance = await creditRepo.getBalance(user.id);

  return {
    user: { id: user.id, email: user.email, name: user.name },
    credits: balance?.balance ?? 0,
    isNewUser,
  };
}

export { oauth };
