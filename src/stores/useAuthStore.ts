import { create } from 'zustand';
import {
  type AuthState,
  type AuthProvider,
  initAuth,
  signInWithGoogle,
  signInWithTwitter,
  signOut as authSignOut,
  refreshCredits,
  updateCredits,
} from '../lib/auth';

interface AuthStore extends AuthState {
  init: () => Promise<void>;
  signIn: (provider?: AuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setCredits: (credits: number) => void;
  deductCredits: (amount: number) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  credits: 0,
  isAuthenticated: false,
  isLoading: true,

  init: async () => {
    set({ isLoading: true });
    try {
      const state = await initAuth();
      set(state);
    } catch {
      set({ user: null, credits: 0, isAuthenticated: false, isLoading: false });
    }
  },

  signIn: async (provider: AuthProvider = 'google') => {
    set({ isLoading: true });
    try {
      const state =
        provider === 'twitter'
          ? await signInWithTwitter()
          : await signInWithGoogle();
      set(state);
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    const state = await authSignOut();
    set(state);
  },

  refresh: async () => {
    if (!get().isAuthenticated) return;
    const credits = await refreshCredits().catch(() => get().credits);
    set({ credits });
  },

  setCredits: (credits: number) => {
    set({ credits });
    updateCredits(credits);
  },

  deductCredits: (amount: number) => {
    const current = get().credits;
    const newCredits = Math.max(0, current - amount);
    set({ credits: newCredits });
    updateCredits(newCredits);
  },
}));
