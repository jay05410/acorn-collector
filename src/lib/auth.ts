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

async function signInWithExtension(): Promise<AuthState> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, async (result) => {
      const token = typeof result === 'string' ? result : result?.token;

      if (chrome.runtime.lastError || !token) {
        reject(
          new Error(
            chrome.runtime.lastError?.message || 'Failed to get auth token'
          )
        );
        return;
      }

      try {
        const loginResult = await apiClient.login(token);
        await storeAuth(loginResult.user, loginResult.credits, token);
        resolve({
          user: loginResult.user,
          credits: loginResult.credits,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (error) {
        chrome.identity.removeCachedAuthToken({ token });
        reject(error);
      }
    });
  });
}

async function signInWithWebOAuth(provider: AuthProvider): Promise<AuthState> {
  const width = 500;
  const height = 600;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  const authUrl =
    provider === 'google'
      ? `${API_BASE_URL}/auth/google?redirect=${encodeURIComponent(window.location.origin)}`
      : `${API_BASE_URL}/auth/twitter?redirect=${encodeURIComponent(window.location.origin)}`;

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

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'AUTH_SUCCESS') {
        window.removeEventListener('message', handleMessage);
        popup.close();

        const { token, user, credits } = event.data;
        await storeAuth(user, credits, token);
        resolve({
          user,
          credits,
          isAuthenticated: true,
          isLoading: false,
        });
      } else if (event.data?.type === 'AUTH_ERROR') {
        window.removeEventListener('message', handleMessage);
        popup.close();
        reject(new Error(event.data.error || '로그인 실패'));
      }
    };

    window.addEventListener('message', handleMessage);

    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
        reject(new Error('로그인이 취소되었습니다.'));
      }
    }, 500);
  });
}

export async function signInWithGoogle(): Promise<AuthState> {
  if (isExtensionEnvironment()) {
    return signInWithExtension();
  }
  return signInWithWebOAuth('google');
}

export async function signInWithTwitter(): Promise<AuthState> {
  if (isExtensionEnvironment()) {
    return signInWithWebOAuth('twitter');
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
