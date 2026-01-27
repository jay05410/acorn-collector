import { apiClient, type ApiUser } from './api-client';

export interface AuthState {
  user: ApiUser | null;
  credits: number;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AUTH_STORAGE_KEY = 'auth_state';
const TOKEN_STORAGE_KEY = 'auth_token';

interface StoredAuthState {
  user: ApiUser;
  credits: number;
}

async function getStoredAuth(): Promise<{
  user: ApiUser;
  credits: number;
  token: string;
} | null> {
  if (!chrome?.storage?.local) return null;

  const result = await chrome.storage.local.get([
    AUTH_STORAGE_KEY,
    TOKEN_STORAGE_KEY,
  ]);
  const authState = result[AUTH_STORAGE_KEY] as StoredAuthState | undefined;
  const token = result[TOKEN_STORAGE_KEY] as string | undefined;

  if (authState && token) {
    return { ...authState, token };
  }
  return null;
}

async function storeAuth(
  user: ApiUser,
  credits: number,
  token: string
): Promise<void> {
  if (!chrome?.storage?.local) return;

  await chrome.storage.local.set({
    [AUTH_STORAGE_KEY]: { user, credits },
    [TOKEN_STORAGE_KEY]: token,
  });
  apiClient.setToken(token);
}

async function clearAuth(): Promise<void> {
  if (!chrome?.storage?.local) return;

  await chrome.storage.local.remove([AUTH_STORAGE_KEY, TOKEN_STORAGE_KEY]);
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

export async function signInWithGoogle(): Promise<AuthState> {
  if (!chrome?.identity?.getAuthToken) {
    throw new Error(
      'Chrome Extension 환경에서만 로그인할 수 있습니다. 익스텐션으로 로드해주세요.'
    );
  }

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

export async function signOut(): Promise<AuthState> {
  if (chrome?.storage?.local) {
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

  if (stored && chrome?.storage?.local) {
    await chrome.storage.local.set({
      [AUTH_STORAGE_KEY]: { user: stored.user, credits: balance.balance },
    });
  }

  return balance.balance;
}

export async function updateCredits(newCredits: number): Promise<void> {
  const stored = await getStoredAuth();
  if (stored && chrome?.storage?.local) {
    await chrome.storage.local.set({
      [AUTH_STORAGE_KEY]: { user: stored.user, credits: newCredits },
    });
  }
}
