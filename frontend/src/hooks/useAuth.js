import { useCallback, useEffect, useState } from 'react'
import { auth } from '../lib/auth.js'

// Owns the global current-user state (planning.md §6.1: `currentUser` in App).
// Restores the session on mount via auth.me(), then exposes the user plus
// setters the Header/AuthModal use after a successful login/logout.
export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    auth
      .me()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await auth.logout()
    } finally {
      setUser(null)
    }
  }, [])

  return { user, loading, setUser, logout }
}
