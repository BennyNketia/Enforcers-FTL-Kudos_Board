import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { auth } from '../lib/auth.js'

// Owns the global current-user state (planning.md §6.1: `currentUser` in App)
// AND the auth-modal state, so any component can gate a mutation behind a
// login prompt via requireAuth(action). Pages subscribe via useAuth() and
// refetch when user.id changes — each user only sees their own boards.

const AuthContext = createContext({
  user: null,
  loading: true,
  setUser: () => {},
  logout: async () => {},
  authModal: { open: false, mode: 'login' },
  openAuth: () => {},
  closeAuth: () => {},
  requireAuth: (fn) => fn?.(),
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authModal, setAuthModal] = useState({ open: false, mode: 'login' })

  // Queued action: if the user closes the modal without signing in we drop it;
  // if they authenticate successfully we run it then clear. A ref keeps it out
  // of render deps so requireAuth doesn't change on every state update.
  const pendingAction = useRef(null)

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

  const openAuth = useCallback((mode = 'login') => {
    setAuthModal({ open: true, mode })
  }, [])

  const closeAuth = useCallback(() => {
    pendingAction.current = null // dismissed = abandon the queued action
    setAuthModal((s) => ({ ...s, open: false }))
  }, [])

  // The success path: store the user, run any action that was waiting on a
  // sign-in, then close. Used as AuthModal's onAuthenticated prop.
  const handleAuthenticated = useCallback((u) => {
    setUser(u)
    const action = pendingAction.current
    pendingAction.current = null
    if (action) Promise.resolve().then(action)
    setAuthModal((s) => ({ ...s, open: false }))
  }, [])

  // Gate a mutation behind a signed-in user. If already signed in, just runs
  // the action. Otherwise queues it and opens the modal — on successful
  // signin/signup, the action fires automatically.
  const requireAuth = useCallback(
    (action, mode = 'login') => {
      if (user) return action?.()
      pendingAction.current = action ?? null
      setAuthModal({ open: true, mode })
    },
    [user],
  )

  return createElement(
    AuthContext.Provider,
    {
      value: {
        user,
        loading,
        setUser: handleAuthenticated,
        logout,
        authModal,
        openAuth,
        closeAuth,
        requireAuth,
      },
    },
    children,
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
