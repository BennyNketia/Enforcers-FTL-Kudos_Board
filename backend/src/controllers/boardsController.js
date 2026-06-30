// Boards controllers — planning.md §2.1.
//
// Ownership model: every board belongs to a user. Listing/reading scope:
//   - signed in  → only the requester's own boards
//   - guest      → only the admin user's boards (acts as a public showcase)
// Mutations (create/delete) always require auth and only touch the caller's
// boards. Card mutations live in cardsController and share assertBoardAccess.
//
// Wire format: `cardCount` is derived (Prisma _count); createdAt is epoch ms.
// Errors flow through next(err) to the central handler in src/index.js.

import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { serializeBoard } from '../lib/serialize.js'

const DEFAULT_COVERS = {
  celebration: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&q=80',
  thankyou: 'https://images.unsplash.com/photo-1606857521015-7f9fcf423740?w=800&q=80',
  inspiration: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=800&q=80',
}

const COUNT_SELECT = { _count: { select: { cards: true } } }

// Compute the ownership clause for a list/read query.
//   signed in → boards owned by req.userId
//   guest     → boards owned by the (single) admin user; empty result if none
// Returned as a Prisma `where` fragment so callers can merge filters into it.
async function ownerScope(req) {
  if (req.userId) return { userId: req.userId }
  const admin = await prisma.user.findFirst({
    where: { isAdmin: true },
    select: { id: true },
  })
  // No admin configured → guests see nothing rather than everything.
  return { userId: admin?.id ?? '__no_admin__' }
}

// GET /api/boards?filter&search
export async function listBoards(req, res, next) {
  try {
    const filter = req.query.filter || 'all'
    const search = (req.query.search || '').trim()

    const where = { ...(await ownerScope(req)) }
    if (filter !== 'all' && filter !== 'recent') where.category = filter
    if (search) where.title = { contains: search, mode: 'insensitive' }

    const boards = await prisma.board.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filter === 'recent' ? 6 : undefined,
      include: COUNT_SELECT,
    })

    res.json(boards.map(serializeBoard))
  } catch (err) {
    next(err)
  }
}

// GET /api/boards/:boardId
export async function getBoard(req, res, next) {
  try {
    const board = await prisma.board.findFirst({
      where: { id: req.params.boardId, ...(await ownerScope(req)) },
      include: COUNT_SELECT,
    })
    if (!board) return res.status(404).json({ error: 'Board not found.' })
    res.json(serializeBoard(board))
  } catch (err) {
    next(err)
  }
}

// POST /api/boards   (auth required — set by route)
export async function createBoard(req, res, next) {
  try {
    const { title, category, imageUrl, author } = req.body
    const board = await prisma.board.create({
      data: {
        userId: req.userId,
        title: title.trim(),
        category,
        imageUrl: imageUrl?.trim() || DEFAULT_COVERS[category],
        author: author?.trim() || null,
      },
      include: COUNT_SELECT,
    })
    res.status(201).json(serializeBoard(board))
  } catch (err) {
    next(err)
  }
}

// DELETE /api/boards/:boardId  → 204, cascades to cards via schema.
// Auth required; scoped to the caller's boards so users can't delete someone else's.
export async function deleteBoard(req, res, next) {
  try {
    const result = await prisma.board.deleteMany({
      where: { id: req.params.boardId, userId: req.userId },
    })
    if (result.count === 0) return res.status(404).json({ error: 'Board not found.' })
    res.status(204).end()
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Board not found.' })
    }
    next(err)
  }
}
