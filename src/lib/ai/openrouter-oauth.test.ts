import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, mockFetch, requestBody } from './testing';
import {
  buildAuthUrl,
  connectWithRedirect,
  createHeadlessFlow,
  createPkcePair,
  exchangeCode,
  parseAuthCode,
  pkceChallenge,
  type IdentityApi,
} from './openrouter-oauth';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PKCE', () => {
  it('matches the RFC 7636 appendix B test vector', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    );
  });

  it('creates unreserved-charset verifiers of valid length with matching challenges', async () => {
    const a = await createPkcePair();
    const b = await createPkcePair();
    expect(a.verifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.challenge).toBe(await pkceChallenge(a.verifier));
  });
});

describe('buildAuthUrl', () => {
  it('encodes the callback, challenge and key label', () => {
    const url = new URL(
      buildAuthUrl({
        callbackUrl: 'https://abc.chromiumapp.org/openrouter',
        challenge: 'E9Mel',
        keyLabel: 'Acorn Collector',
      })
    );
    expect(url.origin + url.pathname).toBe('https://openrouter.ai/auth');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      callback_url: 'https://abc.chromiumapp.org/openrouter',
      code_challenge: 'E9Mel',
      code_challenge_method: 'S256',
      key_label: 'Acorn Collector',
    });
  });

  it('omits callback_url for the headless flow', () => {
    expect(buildAuthUrl({ challenge: 'c', keyLabel: 'k' })).not.toContain('callback_url');
  });
});

describe('exchangeCode', () => {
  it('posts code + verifier and returns the key', async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, { key: 'sk-or-v1-new', user_id: 'user_1' }));
    expect(await exchangeCode({ code: 'c0de', verifier: 'v' })).toEqual({
      key: 'sk-or-v1-new',
      userId: 'user_1',
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://openrouter.ai/api/v1/auth/keys');
    expect(requestBody(fetchMock)).toEqual({
      code: 'c0de',
      code_verifier: 'v',
      code_challenge_method: 'S256',
    });
  });

  it('maps rejected codes to auth and malformed responses to bad_response', async () => {
    mockFetch(() => jsonResponse(400, { error: { code: 400, message: 'Invalid code' } }));
    await expect(exchangeCode({ code: 'x', verifier: 'v' })).rejects.toMatchObject({ code: 'auth' });

    mockFetch(() => jsonResponse(403, { error: { code: 403, message: 'Forbidden' } }));
    await expect(exchangeCode({ code: 'x', verifier: 'v' })).rejects.toMatchObject({ code: 'auth' });

    mockFetch(() => jsonResponse(200, { user_id: 'u' }));
    await expect(exchangeCode({ code: 'x', verifier: 'v' })).rejects.toMatchObject({
      code: 'bad_response',
    });
  });
});

describe('parseAuthCode', () => {
  it.each([
    ['  abc-123_XY  ', 'abc-123_XY'],
    ['https://abc.chromiumapp.org/openrouter?code=a%2Bb&state=1', 'a+b'],
    ['http://localhost:3000/?code=zz', 'zz'],
    ['', null],
    ['not a code!', null],
  ])('%j -> %j', (input, expected) => {
    expect(parseAuthCode(input)).toBe(expected);
  });
});

function fakeIdentity(result: () => Promise<string | undefined>) {
  const launched: string[] = [];
  const identity: IdentityApi = {
    getRedirectURL: (path) => `https://abcdef.chromiumapp.org/${path ?? ''}`,
    launchWebAuthFlow: async ({ url, interactive }) => {
      expect(interactive).toBe(true);
      launched.push(url);
      return result();
    },
  };
  return { identity, launched };
}

describe('connectWithRedirect', () => {
  it('runs the web auth flow with the chromiumapp.org callback and exchanges the code', async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, { key: 'sk-or-v1-k', user_id: 'u' }));
    const { identity, launched } = fakeIdentity(async () => 'https://abcdef.chromiumapp.org/openrouter?code=granted');
    const creds = await connectWithRedirect({ keyLabel: 'Acorn', identity });
    expect(creds).toEqual({ key: 'sk-or-v1-k', userId: 'u' });

    const authUrl = new URL(launched[0] ?? '');
    expect(authUrl.searchParams.get('callback_url')).toBe('https://abcdef.chromiumapp.org/openrouter');
    const sent = requestBody(fetchMock);
    expect(sent.code).toBe('granted');
    expect(await pkceChallenge(String(sent.code_verifier))).toBe(authUrl.searchParams.get('code_challenge'));
  });

  it('maps a closed window to cancelled and other failures to auth', async () => {
    const closed = fakeIdentity(async () => {
      throw new Error('The user did not approve access.');
    });
    await expect(connectWithRedirect({ keyLabel: 'k', identity: closed.identity })).rejects.toMatchObject({
      code: 'cancelled',
    });

    const broken = fakeIdentity(async () => {
      throw new Error('Authorization page could not be loaded.');
    });
    await expect(connectWithRedirect({ keyLabel: 'k', identity: broken.identity })).rejects.toMatchObject({
      code: 'auth',
    });

    const noCode = fakeIdentity(async () => 'https://abcdef.chromiumapp.org/openrouter?error=denied');
    await expect(connectWithRedirect({ keyLabel: 'k', identity: noCode.identity })).rejects.toMatchObject({
      code: 'auth',
    });
  });

  it('reports a missing identity permission as not_configured', async () => {
    await expect(connectWithRedirect({ keyLabel: 'k' })).rejects.toMatchObject({
      code: 'not_configured',
    });
  });
});

describe('createHeadlessFlow', () => {
  it('builds a callback-less URL and completes with a pasted code', async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, { key: 'sk-or-v1-h', user_id: null }));
    const flow = await createHeadlessFlow('Acorn');
    const url = new URL(flow.authUrl);
    expect(url.searchParams.has('callback_url')).toBe(false);
    expect(url.searchParams.get('code_challenge')).toBe(await pkceChallenge(flow.verifier));

    expect(await flow.complete('  pasted-code \n')).toEqual({ key: 'sk-or-v1-h', userId: null });
    expect(requestBody(fetchMock)).toMatchObject({ code: 'pasted-code', code_verifier: flow.verifier });
  });

  it('rejects input that is not a code without calling the API', async () => {
    const fetchMock = mockFetch(() => jsonResponse(200, {}));
    const flow = await createHeadlessFlow('Acorn');
    await expect(flow.complete('hello world')).rejects.toMatchObject({ code: 'auth' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
