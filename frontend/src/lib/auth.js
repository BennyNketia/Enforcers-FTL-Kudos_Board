// ============================================================================
// Auth data layer.
//
// Mirrors lib/api.js: the same module exposes one uniform contract and chooses
// between a real HTTP backend and a localStorage fallback. The Express + Prisma
// auth endpoints (planning.md §6.1: POST /api/auth/signup, /login, /logout and
// GET /api/auth/me) aren't built yet, so the localStorage path lets the UI work
// end-to-end in the demo. When the backend lands, set VITE_USE_API=true and the
// http* paths run — components consume these functions, not storage details.
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

async function http(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include', // send/receive the session cookie
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new AuthError(res.status, data?.error || res.statusText)
  return data
}

// ---- public API (uniform regardless of backend) ---------------------------

export const auth = {
  signup: (data) => (USE_API ? http('POST', '/auth/signup', data) : localSignup(data)),
  login: (data) => (USE_API ? http('POST', '/auth/login', data) : localLogin(data)),
  logout: () => (USE_API ? http('POST', '/auth/logout') : localLogout()),
  // Returns the current user or null. The HTTP backend returns 401 for guests;
  // treat that as "not signed in" rather than an error.
  me: async () => {
    if (!USE_API) return localMe()
    try {
      return await http('GET', '/auth/me')
    } catch (err) {
      if (err.status === 401) return null
      throw err
    }
  },
}

export { AuthError }
