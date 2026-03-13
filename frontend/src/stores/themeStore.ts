import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  toggleTheme: () => void
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

// Apply on module load to avoid flash
const stored = (() => {
  try {
    const raw = localStorage.getItem('theme-storage')
    if (raw) {
      const parsed = JSON.parse(raw)
      return (parsed.state?.theme as Theme) ?? 'light'
    }
  } catch { /* empty */ }
  return 'light' as Theme
})()
applyTheme(stored)

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: stored,
      toggleTheme: () => {
        const next = get().theme === 'light' ? 'dark' : 'light'
        applyTheme(next)
        set({ theme: next })
      },
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme)
      },
    }
  )
)
