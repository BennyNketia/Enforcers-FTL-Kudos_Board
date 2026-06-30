import { createContext, createElement, useCallback, useContext, useEffect, useState } from 'react'
import { auth } from '../lib/auth.js'

// Owns the global current-user state (planning.md §6.1: `currentUser` in App).
// Pages subscribe via useAuth() so they can refetch when the user changes —
// each user sees only their own boards (guests see admin's), so a login or
// logout invalidates everything in the data layer.

const AuthContext = createContext({ user: null, loading: true, setUser: () => {}, logout: async () => {} })

export function AuthProvider({ children }) {
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

  return createElement(AuthContext.Provider, { value: { user, loading, setUser, logout } }, children)
}

export function useAuth() {
  return useContext(AuthContext)
}
