// Cards controllers — planning.md §2.2.
//
// Ownership: cards inherit the parent board's owner. Reads obey the same
// scope as boards (guests see admin boards' cards; signed-in users see only
// their own). Writes require auth AND that req.userId owns the board.
//
// Ordering invariant (planning.md §5): pinned cards first by `pinnedAt` desc,
// then unpinned by `createdAt` desc. SQL `ORDER BY pinned DESC, pinnedAt DESC NULLS LAST,
// createdAt DESC` gives that in one query.

import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { serializeCard } from '../lib/serialize.js'

const ORDER = [
  { pinned: 'desc' },
  { pinnedAt: { sort: 'desc', nulls: 'last' } },
  { createdAt: 'desc' },
]

// Returns the board if the caller may READ it (guest → must be admin's;
// signed in → must be theirs). Throws 404 otherwise so a foreign board id
// is indistinguishable from a missing one (no leaking existence).
async function findReadableBoard(req, boardId) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { id: true, userId: true, user: { select: { isAdmin: true } } },
  })
  if (!board) return null
  if (req.userId) return board.userId === req.userId ? board : null
  return board.user?.isAdmin ? board : null
}

// Returns the board if the caller OWNS it. Used for any mutation.
async function findOwnedBoard(userId, boardId) {
  if (!userId) return null
  const board = await prisma.board.findFirst({
    where: { id: boardId, userId },
    select: { id: true },
  })
  return board
}

// GET /api/boards/:boardId/cards
export async function listCards(req, res, next) {
  try {
    const board = await findReadableBoard(req, req.params.boardId)
    if (!board) return res.status(404).json({ error: 'Board not found.' })

    const cards = await prisma.card.findMany({
      where: { boardId: board.id },
      orderBy: ORDER,
    })
    res.json(cards.map(serializeCard))
  } catch (err) {
    next(err)
  }
}

// POST /api/boards/:boardId/cards   (auth required by route)
export async function createCard(req, res, next) {
  try {
    const board = await findOwnedBoard(req.userId, req.params.boardId)
    if (!board) return res.status(404).json({ error: 'Board not found.' })

    const { message, gifUrl, author } = req.body
    const card = await prisma.card.create({
      data: {
        boardId: board.id,
        message: message.trim(),
        gifUrl: gifUrl.trim(),
        author: author?.trim() || null,
      },
    })
    res.status(201).json(serializeCard(card))
  } catch (err) {
    next(err)
  }
}

// DELETE /api/boards/:boardId/cards/:cardId   (auth required)
export async function deleteCard(req, res, next) {
  try {
    const { boardId, cardId } = req.params
    const board = await findOwnedBoard(req.userId, boardId)
    if (!board) return res.status(404).json({ error: 'Card not found.' })

    const result = await prisma.card.deleteMany({ where: { id: cardId, boardId } })
    if (result.count === 0) return res.status(404).json({ error: 'Card not found.' })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

// PATCH /api/boards/:boardId/cards/:cardId/upvote  → +1   (auth required)
export async function upvoteCard(req, res, next) {
  try {
    const { boardId, cardId } = req.params
    const board = await findOwnedBoard(req.userId, boardId)
    if (!board) return res.status(404).json({ error: 'Card not found.' })

    const existing = await prisma.card.findFirst({
      where: { id: cardId, boardId },
      select: { id: true },
    })
    if (!existing) return res.status(404).json({ error: 'Card not found.' })

    const card = await prisma.card.update({
      where: { id: cardId },
      data: { upvotes: { increment: 1 } },
    })
    res.json(serializeCard(card))
  } catch (err) {
    next(err)
  }
}

// PATCH /api/boards/:boardId/cards/:cardId/pin  body: { pinned: boolean }   (auth required)
export async function pinCard(req, res, next) {
  try {
    const { boardId, cardId } = req.params
    const { pinned } = req.body
    const board = await findOwnedBoard(req.userId, boardId)
    if (!board) return res.status(404).json({ error: 'Card not found.' })

    const existing = await prisma.card.findFirst({
      where: { id: cardId, boardId },
      select: { id: true },
    })
    if (!existing) return res.status(404).json({ error: 'Card not found.' })

    const card = await prisma.card.update({
      where: { id: cardId },
      data: { pinned, pinnedAt: pinned ? new Date() : null },
    })
    res.json(serializeCard(card))
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Card not found.' })
    }
    next(err)
  }
}
