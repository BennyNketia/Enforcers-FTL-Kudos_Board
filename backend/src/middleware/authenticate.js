// Auth middleware — reads a Bearer token and attaches req.userId.
//
//   authenticate    requires a valid token; 401s otherwise. Use on protected routes.
//   optionalAuth    attaches req.userId when a valid token is present, else continues
//                   as a guest (req.userId stays undefined). Use on /me.

import { verifyToken } from '../lib/auth.js'

// Pull the raw token out of "Authorization: Bearer <token>", or null if absent.
function readToken(req) {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null
}

export function authenticate(req, res, next) {
  const token = readToken(req)
  if (!token) return res.status(401).json({ error: 'Authentication required.' })
  try {
    req.userId = verifyToken(token)
    next()
  } catch {
    // Tampered, malformed, or expired — all surface as "not authenticated".
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
  }
}

export function optionalAuth(req, _res, next) {
  const token = readToken(req)
  if (token) {
    try {
      req.userId = verifyToken(token)
    } catch {
      // Ignore a bad token here; the route treats this as a guest.
    }
  }
  next()
}
