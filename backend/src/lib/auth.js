// ============================================================================
// Auth crypto helpers — the single place that hashes passwords and signs/verifies
// JWTs. Controllers and middleware call these; the bcrypt/jwt mechanics and the
// JWT_SECRET (read from process.env) never leak elsewhere.
//
// Tokens are stateless: the server signs a token at login and verifies its
// signature on later requests, with no server-side session store. The tradeoff
// is that a token can't be revoked before it expires — see TOKEN_TTL.
// ============================================================================

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// bcrypt cost factor: 2^10 rounds. Deliberately slow so brute-forcing a stolen
// hash is expensive; bcrypt also salts automatically, so equal passwords differ.
const SALT_ROUNDS = 10

// How long a login stays valid. After this the token is rejected and the user
// must sign in again. Short-ish because we can't revoke a JWT early.
const TOKEN_TTL = '7d'

// Thrown when JWT_SECRET isn't set. The error handler turns this into a clean
// 500 with a helpful message instead of a stack trace (mirrors the other libs).
export class AuthConfigError extends Error {
  constructor() {
    super('Auth is not configured. Add JWT_SECRET to backend/.env and restart the server.')
    this.name = 'AuthConfigError'
  }
}

function secret() {
  const s = process.env.JWT_SECRET
  if (!s) throw new AuthConfigError()
  return s
}

// One-way hash. Returns a promise of the hash string (salt is baked in).
export function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

// Compare a plaintext attempt against a stored hash. Promise<boolean>.
export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}

// Sign a token for a user id. `sub` (subject) is the standard claim for "who".
export function signToken(userId) {
  return jwt.sign({ sub: userId }, secret(), { expiresIn: TOKEN_TTL })
}

// Verify a token and return its user id. Throws if tampered, malformed, or expired.
export function verifyToken(token) {
  const payload = jwt.verify(token, secret())
  return payload.sub
}
