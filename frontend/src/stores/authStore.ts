import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (user: User, accessToken: string, refreshToken: string) => void
  setAccessToken: (accessToken: string, refreshToken?: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      login: (user, accessToken, refreshToken) =>
        set({
          user,
          token: accessToken,
          refreshToken,
          isAuthenticated: true,
        }),
      setAccessToken: (accessToken, refreshToken) =>
        set((state) => ({
          token: accessToken,
          refreshToken: refreshToken ?? state.refreshToken,
          isAuthenticated: state.user !== null,
        })),
      logout: () => set({ user: null, token: null, refreshToken: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
)
