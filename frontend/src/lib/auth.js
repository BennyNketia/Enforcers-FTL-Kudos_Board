// ============================================================================
// Auth data layer.
//
// Mirrors lib/api.js: the same module exposes one uniform contract and chooses
// between a real HTTP backend and a localStorage fallback. The Express + Prisma
// auth endpoints (planning.md §6.1: POST /api/auth/signup, /login, /logout and
// GET /api/auth/me) are implemented with stateless JWTs. Set VITE_USE_API=true
// to use them; otherwise the localStorage path keeps the UI working offline.
// Components consume these functions, not storage/token details.
// ============================================================================

const USE_API = import.meta.env.VITE_USE_API === 'true'
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

// Where the local fallback persists the "session" + registered accounts.
const SESSION_KEY = 'kudos-auth-user'
const USERS_KEY = 'kudos-auth-users'

class AuthError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// ---- local storage helpers -------------------------------------------------

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Never expose the (already weak, demo-only) stored password to callers.
function publicUser(user) {
  return { id: user.id, username: user.username, createdAt: user.createdAt }
}

// ---- local fallback implementation -----------------------------------------
//
// NOTE: this stores passwords in plain text in localStorage. That is fine for a
// client-only demo with no real data — the real backend hashes passwords. Do
// not treat this path as secure.

async function localSignup({ username, password }) {
  const name = username.trim()
  if (name.length < 2) throw new AuthError(400, 'Username must be at least 2 characters.')
  if (password.length < 4) throw new AuthError(400, 'Password must be at least 4 characters.')

  const users = read(USERS_KEY, [])
  if (users.some((u) => u.username.toLowerCase() === name.toLowerCase())) {
    throw new AuthError(409, 'That username is already taken.')
  }

  const user = { id: uuid(), username: name, password, createdAt: Date.now() }
  write(USERS_KEY, [...users, user])
  write(SESSION_KEY, publicUser(user))
  return publicUser(user)
}

async function localLogin({ username, password }) {
  const name = username.trim()
  const user = read(USERS_KEY, []).find(
    (u) => u.username.toLowerCase() === name.toLowerCase(),
  )
  if (!user || user.password !== password) {
    throw new AuthError(401, 'Incorrect username or password.')
  }
  write(SESSION_KEY, publicUser(user))
  return publicUser(user)
}

async function localLogout() {
  localStorage.removeItem(SESSION_KEY)
  return null
}

async function localMe() {
  return read(SESSION_KEY, null)
}

// ---- HTTP implementation (used when VITE_USE_API=true) ---------------------
//
// The backend uses stateless JWTs (not cookies): signup/login return
// { token, user }. We persist the token and send it as `Authorization: Bearer`
// on later requests. Logout just discards the token client-side.
//
// NOTE: storing the token in localStorage exposes it to XSS (any injected
// script can read it). That's the accepted tradeoff for header-based JWT auth;
// an httpOnly cookie would be safer but requires a cookie-session backend.

const TOKEN_KEY = 'kudos-auth-token'

function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function http(method, path, body) {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new AuthError(res.status, data?.error || res.statusText)
  return data
}

// signup/login return { token, user }: stash the token, hand back just the user
// so callers (AuthModal) keep their existing contract.
async function httpAuthenticate(path, data) {
  const { token, user } = await http('POST', path, data)
  setToken(token)
  return user
}

// ---- public API (uniform regardless of backend) ---------------------------

export const auth = {
  signup: (data) => (USE_API ? httpAuthenticate('/auth/signup', data) : localSignup(data)),
  login: (data) => (USE_API ? httpAuthenticate('/auth/login', data) : localLogin(data)),
  logout: async () => {
    if (!USE_API) return localLogout()
    try {
      await http('POST', '/auth/logout')
    } finally {
      setToken(null) // discard the token even if the request fails
    }
    return null
  },
  // Returns the current user or null. No token → skip the call. The backend
  // returns null (or 401) for an invalid token; treat both as "not signed in".
  me: async () => {
    if (!USE_API) return localMe()
    if (!getToken()) return null
    try {
      return await http('GET', '/auth/me')
    } catch (err) {
      if (err.status === 401) return null
      throw err
    }
  },
}

export { AuthError }
