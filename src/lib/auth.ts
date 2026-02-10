import { apiClient, type ApiUser } from './api-client';

export interface AuthState {
  user: ApiUser | null;
  credits: number;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export type AuthProvider = 'google' | 'twitter';

const AUTH_STORAGE_KEY = 'auth_state';
const TOKEN_STORAGE_KEY = 'auth_token';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'https://acorn-collector-api.workers.dev';

interface StoredAuthState {
  user: ApiUser;
  credits: number;
}

function isExtensionEnvironment(): boolean {
  return !!chrome?.identity?.getAuthToken;
}

async function getStoredAuth(): Promise<{
  user: ApiUser;
  credits: number;
  token: string;
} | null> {
  if (isExtensionEnvironment() && chrome?.storage?.local) {
    const result = await chrome.storage.local.get([
      AUTH_STORAGE_KEY,
      TOKEN_STORAGE_KEY,
    ]);
    const authState = result[AUTH_STORAGE_KEY] as StoredAuthState | undefined;
    const token = result[TOKEN_STORAGE_KEY] as string | undefined;
    if (authState && token) {
      return { ...authState, token };
    }
  } else {
    const authState = localStorage.getItem(AUTH_STORAGE_KEY);
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (authState && token) {
      return { ...JSON.parse(authState), token };
    }
  }
  return null;
}

async function storeAuth(
  user: ApiUser,
  credits: number,
  token: string
): Promise<void> {
  if (isExtensionEnvironment() && chrome?.storage?.local) {
    await chrome.storage.local.set({
      [AUTH_STORAGE_KEY]: { user, credits },
      [TOKEN_STORAGE_KEY]: token,
    });
  } else {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, credits }));
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  }
  apiClient.setToken(token);
}

async function clearAuth(): Promise<void> {
  if (isExtensionEnvironment() && chrome?.storage?.local) {
    await chrome.storage.local.remove([AUTH_STORAGE_KEY, TOKEN_STORAGE_KEY]);
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
  apiClient.setToken(null);
}

export async function initAuth(): Promise<AuthState> {
  const stored = await getStoredAuth();
  if (stored) {
    apiClient.setToken(stored.token);
    return {
      user: stored.user,
      credits: stored.credits,
      isAuthenticated: true,
      isLoading: false,
    };
  }
  return {
    user: null,
    credits: 0,
    isAuthenticated: false,
    isLoading: false,
  };
}

function parseOAuthResult(
  data: Record<string, unknown>
): AuthState {
  if (data.type === 'AUTH_SUCCESS') {
    return {
      user: data.user as ApiUser,
      credits: data.credits as number,
      isAuthenticated: true,
      isLoading: false,
    };
  }
  throw new Error((data.error as string) || '로그인 실패');
}

async function signInWithExtensionOAuth(
  provider: AuthProvider
): Promise<AuthState> {
  const redirectUrl = chrome.identity.getRedirectURL();
  const authUrl = `${API_BASE_URL}/oauth/${provider}?redirect=${encodeURIComponent(redirectUrl)}`;

  const responseUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      (url) => {
        if (chrome.runtime.lastError || !url) {
          reject(
            new Error(chrome.runtime.lastError?.message || '로그인 실패')
          );
          return;
        }
        resolve(url);
      }
    );
  });

  const hashIndex = responseUrl.indexOf('#');
  if (hashIndex === -1) throw new Error('인증 데이터 없음');

  const hash = responseUrl.substring(hashIndex + 1);
  const data = JSON.parse(decodeURIComponent(hash));
  const state = parseOAuthResult(data);
  await storeAuth(state.user!, state.credits, data.token);
  return state;
}

async function signInWithWebOAuth(provider: AuthProvider): Promise<AuthState> {
  const width = 500;
  const height = 600;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  const redirectTarget = `${window.location.origin}/oauth-callback.html`;
  const authUrl = `${API_BASE_URL}/oauth/${provider}?redirect=${encodeURIComponent(redirectTarget)}`;

  localStorage.removeItem('__oauth_result');

  return new Promise((resolve, reject) => {
    const popup = window.open(
      authUrl,
      'auth_popup',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      reject(new Error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.'));
      return;
    }

    const cleanup = () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(pollTimer);
      clearTimeout(timeout);
    };

    const processResult = async (raw: string) => {
      cleanup();
      localStorage.removeItem('__oauth_result');
      try {
        const data = JSON.parse(raw);
        const state = parseOAuthResult(data);
        await storeAuth(state.user!, state.credits, data.token);
        resolve(state);
      } catch (e) {
        reject(e instanceof Error ? e : new Error('로그인 처리 실패'));
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === '__oauth_result' && event.newValue) {
        processResult(event.newValue);
      }
    };

    window.addEventListener('storage', handleStorage);

    const pollTimer = setInterval(() => {
      const result = localStorage.getItem('__oauth_result');
      if (result) processResult(result);
    }, 500);

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('로그인 시간이 초과되었습니다.'));
    }, 60000);
  });
}

export async function signInWithGoogle(): Promise<AuthState> {
  if (isExtensionEnvironment()) {
    return signInWithExtensionOAuth('google');
  }
  return signInWithWebOAuth('google');
}

export async function signInWithTwitter(): Promise<AuthState> {
  if (isExtensionEnvironment()) {
    return signInWithExtensionOAuth('twitter');
  }
  return signInWithWebOAuth('twitter');
}

export async function signOut(): Promise<AuthState> {
  if (isExtensionEnvironment() && chrome?.storage?.local) {
    const result = await chrome.storage.local.get(TOKEN_STORAGE_KEY);
    const token = result[TOKEN_STORAGE_KEY] as string | undefined;
    if (token && chrome?.identity?.removeCachedAuthToken) {
      await new Promise<void>((resolve) => {
        chrome.identity.removeCachedAuthToken({ token }, resolve);
      });
    }
  }

  await clearAuth();

  return {
    user: null,
    credits: 0,
    isAuthenticated: false,
    isLoading: false,
  };
}

export async function refreshCredits(): Promise<number> {
  const balance = await apiClient.getBalance();
  const stored = await getStoredAuth();

  if (stored) {
    if (isExtensionEnvironment() && chrome?.storage?.local) {
      await chrome.storage.local.set({
        [AUTH_STORAGE_KEY]: { user: stored.user, credits: balance.balance },
      });
    } else {
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ user: stored.user, credits: balance.balance })
      );
    }
  }

  return balance.balance;
}

export async function updateCredits(newCredits: number): Promise<void> {
  const stored = await getStoredAuth();
  if (stored) {
    if (isExtensionEnvironment() && chrome?.storage?.local) {
      await chrome.storage.local.set({
        [AUTH_STORAGE_KEY]: { user: stored.user, credits: newCredits },
      });
    } else {
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ user: stored.user, credits: newCredits })
      );
    }
  }
}
