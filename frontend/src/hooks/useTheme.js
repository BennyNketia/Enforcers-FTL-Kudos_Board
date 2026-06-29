import { useCallback, useEffect, useState } from 'react'

const THEME_KEY = 'kudos-theme'

// Owns the global light/dark theme. Defaults to light on first visit
// (per the spec), persists the choice, and applies it to <html data-theme>.
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore storage errors */
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme }
}
