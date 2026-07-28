import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile } from '../types';

interface AuthState {
  user:       UserProfile | null;
  isLoading:  boolean;
  setUser:    (u: UserProfile | null) => void;
  setLoading: (v: boolean) => void;
  logout:     () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      user:       null,
      isLoading:  true,
      setUser:    user      => set({ user, isLoading: false }),
      setLoading: isLoading => set({ isLoading }),
      logout:     ()        => set({ user: null }),
    }),
    { name: 'vibe-auth', partialize: s => ({ user: s.user }) },
  ),
);