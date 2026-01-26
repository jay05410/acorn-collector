import type {
  GoogleAuthProvider,
  GoogleUserInfo,
} from '../../domain/usecases/authenticate-user';

export class GoogleAuthProviderImpl implements GoogleAuthProvider {
  constructor(private clientId: string) {}

  async verifyToken(idToken: string): Promise<GoogleUserInfo> {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    );

    if (!response.ok) {
      throw new InvalidTokenError('Invalid Google ID token');
    }

    const payload = (await response.json()) as GoogleTokenPayload;

    if (payload.aud !== this.clientId) {
      throw new InvalidTokenError('Token audience mismatch');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name ?? null,
      picture: payload.picture ?? null,
    };
  }
}

interface GoogleTokenPayload {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  aud: string;
  exp: string;
}

export class InvalidTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTokenError';
  }
}
