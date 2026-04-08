import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MeResponse } from '../types/api';

interface AuthState {
  user: MeResponse | null;
  setUser: (user: MeResponse) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),
    }),
    { name: 'auth-storage' },
  ),
);
