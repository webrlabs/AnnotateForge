import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';

interface AuthStore {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    set => ({
      user: null,
      token: null,

      setAuth: (user, token) =>
        set({
          user,
          token,
        }),

      clearAuth: () =>
        set({
          user: null,
          token: null,
        }),

      isAuthenticated: () => {
        const state = useAuthStore.getState();
        return state.token !== null && state.user !== null;
      },
    }),
    {
      name: 'annotateforge-auth',
    }
  )
);
