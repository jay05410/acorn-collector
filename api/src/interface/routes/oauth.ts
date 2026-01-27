import { Hono } from 'hono';
import type { Env } from '../../config/types';
import { D1UserRepository } from '../../infrastructure/database/d1-user-repository';
import { D1CreditRepository } from '../../infrastructure/database/d1-credit-repository';
import {
  createOAuthProvider,
  type ProviderType,
  type OAuthUserInfo,
} from '../../infrastructure/auth/oauth-provider';

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
  const redirectUri = `${new URL(c.req.url).origin}/oauth/${provider}/callback`;

  const stateData = JSON.stringify({ state, redirect });
  const encodedState = btoa(stateData);

  const authUrl = oauthProvider.getAuthUrl(redirectUri, encodedState);
  return c.redirect(authUrl);
});

oauth.get('/:provider/callback', async (c) => {
  const provider = c.req.param('provider') as ProviderType;
  const code = c.req.query('code');
  const stateParam = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.html(createErrorPage(error));
  }

  if (!code || !stateParam) {
    return c.html(createErrorPage('Missing code or state'));
  }

  let redirect = '';
  try {
    const stateData = JSON.parse(atob(stateParam));
    redirect = stateData.redirect || '';
  } catch {
    return c.html(createErrorPage('Invalid state'));
  }

  const config = getProviderConfig(c.env, provider);
  const oauthProvider = createOAuthProvider(
    provider,
    config.clientId,
    config.clientSecret
  );
  const redirectUri = `${new URL(c.req.url).origin}/oauth/${provider}/callback`;

  try {
    const tokens = await oauthProvider.exchangeCode(code, redirectUri);
    const userInfo = await oauthProvider.getUserInfo(tokens.accessToken);

    const { user, credits } = await findOrCreateUser(c.env.DB, userInfo);

    return c.html(
      createSuccessPage(redirect, tokens.accessToken, user, credits)
    );
  } catch (err) {
    console.error('OAuth callback error:', err);
    return c.html(createErrorPage('Authentication failed'));
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
    await creditRepo.initializeBalance(user.id);
    isNewUser = true;
  }

  const balance = await creditRepo.getBalance(user.id);

  return {
    user: { id: user.id, email: user.email, name: user.name },
    credits: balance?.balance ?? 0,
    isNewUser,
  };
}

function createSuccessPage(
  redirect: string,
  token: string,
  user: { id: string; email: string; name: string | null },
  credits: number
): string {
  return `<!DOCTYPE html>
<html>
<head><title>로그인 성공</title></head>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage({
      type: 'AUTH_SUCCESS',
      token: '${token}',
      user: ${JSON.stringify(user)},
      credits: ${credits}
    }, '${redirect || '*'}');
    window.close();
  } else {
    document.body.innerHTML = '<p>로그인 성공! 이 창을 닫아주세요.</p>';
  }
</script>
</body>
</html>`;
}

function createErrorPage(error: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>로그인 실패</title></head>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage({
      type: 'AUTH_ERROR',
      error: '${error}'
    }, '*');
    window.close();
  } else {
    document.body.innerHTML = '<p>로그인 실패: ${error}</p>';
  }
</script>
</body>
</html>`;
}

export { oauth };
