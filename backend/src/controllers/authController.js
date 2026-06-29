// Auth controllers — signup / login / logout / me (planning.md §6.1).
//
// Wire format the frontend expects (frontend/src/lib/auth.js):
//   signup/login → { token, user }   (user = { id, username, createdAt })
//   me           → the user, or null for a guest
//   logout       → 204
// Passwords are bcrypt-hashed; the hash never leaves the server.

import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { hashPassword, verifyPassword, signToken } from '../lib/auth.js'

const MIN_USERNAME = 2
const MIN_PASSWORD = 4

// Shape a user row for the wire — never expose passwordHash. createdAt is epoch
// ms to match the rest of the API (see lib/serialize.js).
function publicUser(user) {
  return { id: user.id, username: user.username, createdAt: user.createdAt.getTime() }
}

// POST /api/auth/signup  { username, password } → 201 { token, user }
export async function signup(req, res, next) {
  try {
    const username = String(req.body?.username || '').trim()
    const password = String(req.body?.password || '')

    if (username.length < MIN_USERNAME) {
      return res.status(400).json({ error: `Username must be at least ${MIN_USERNAME} characters.` })
    }
    if (password.length < MIN_PASSWORD) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters.` })
    }

    const user = await prisma.user.create({
      data: { username, passwordHash: await hashPassword(password) },
    })

    res.status(201).json({ token: signToken(user.id), user: publicUser(user) })
  } catch (err) {
    // @unique violation on username — the DB is the source of truth, not a pre-check.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'That username is already taken.' })
    }
    next(err)
  }
}

// POST /api/auth/login  { username, password } → 200 { token, user }
export async function login(req, res, next) {
  try {
    const username = String(req.body?.username || '').trim()
    const password = String(req.body?.password || '')

    const user = await prisma.user.findUnique({ where: { username } })
    // Same generic error whether the user is missing or the password is wrong —
    // never reveal which usernames exist (prevents account enumeration).
    const ok = user && (await verifyPassword(password, user.passwordHash))
    if (!ok) return res.status(401).json({ error: 'Incorrect username or password.' })

    res.json({ token: signToken(user.id), user: publicUser(user) })
  } catch (err) {
    next(err)
  }
}

// POST /api/auth/logout → 204
// A JWT is stateless and can't be revoked server-side, so logout is a no-op
// here; the frontend discards its stored token. Endpoint exists for symmetry.
export async function logout(_req, res) {
  res.status(204).end()
}

// GET /api/auth/me → the user, or null (uses optionalAuth, so guests reach here).
export async function me(req, res, next) {
  try {
    if (!req.userId) return res.json(null)
    const user = await prisma.user.findUnique({ where: { id: req.userId } })
    res.json(user ? publicUser(user) : null)
  } catch (err) {
    next(err)
  }
}
