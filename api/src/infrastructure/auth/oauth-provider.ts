export interface OAuthUserInfo {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  provider: 'google' | 'twitter';
}

export interface OAuthProvider {
  getAuthUrl(redirectUri: string, state: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;
  getUserInfo(accessToken: string): Promise<OAuthUserInfo>;
  verifyIdToken?(idToken: string): Promise<OAuthUserInfo>;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn: number;
}

export class GoogleOAuthProvider implements OAuthProvider {
  constructor(
    private clientId: string,
    private clientSecret: string
  ) {}

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for tokens');
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      id_token?: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      idToken: data.id_token,
      expiresIn: data.expires_in,
    };
  }

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    const data = (await response.json()) as {
      id: string;
      email: string;
      name?: string;
      picture?: string;
    };

    return {
      id: data.id,
      email: data.email,
      name: data.name ?? null,
      picture: data.picture ?? null,
      provider: 'google',
    };
  }

  async verifyIdToken(idToken: string): Promise<OAuthUserInfo> {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    );

    if (!response.ok) {
      throw new Error('Invalid ID token');
    }

    const data = (await response.json()) as {
      sub: string;
      email: string;
      name?: string;
      picture?: string;
      aud: string;
    };

    if (data.aud !== this.clientId) {
      throw new Error('Token audience mismatch');
    }

    return {
      id: data.sub,
      email: data.email,
      name: data.name ?? null,
      picture: data.picture ?? null,
      provider: 'google',
    };
  }
}

export class TwitterOAuthProvider implements OAuthProvider {
  constructor(
    private clientId: string,
    private clientSecret: string
  ) {}

  getAuthUrl(redirectUri: string, state: string): string {
    const codeChallenge = state;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: 'tweet.read users.read offline.access',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'plain',
    });
    return `https://twitter.com/i/oauth2/authorize?${params}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const credentials = btoa(`${this.clientId}:${this.clientSecret}`);

    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: code,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code: ${error}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    const response = await fetch(
      'https://api.twitter.com/2/users/me?user.fields=profile_image_url',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    const data = (await response.json()) as {
      data: {
        id: string;
        username: string;
        name: string;
        profile_image_url?: string;
      };
    };

    return {
      id: data.data.id,
      email: `${data.data.username}@twitter.placeholder`,
      name: data.data.name,
      picture: data.data.profile_image_url ?? null,
      provider: 'twitter',
    };
  }
}

export type ProviderType = 'google' | 'twitter';

export function createOAuthProvider(
  type: ProviderType,
  clientId: string,
  clientSecret: string
): OAuthProvider {
  switch (type) {
    case 'google':
      return new GoogleOAuthProvider(clientId, clientSecret);
    case 'twitter':
      return new TwitterOAuthProvider(clientId, clientSecret);
    default:
      throw new Error(`Unknown provider: ${type}`);
  }
}
