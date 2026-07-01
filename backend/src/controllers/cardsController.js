// Cards controllers — planning.md §2.2.
//
// Visibility model: every card is globally readable. Mutations require auth.
// Anyone signed in can create cards on any board and upvote; only the card's
// creator may delete it, and only the board's owner may pin/unpin cards. Each
// serialized card carries an `isOwner` flag so the frontend can hide the
// delete button for non-owners.
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

// Throws 404 if the parent board is missing. Used by every /boards/:boardId/cards route.
async function assertBoardExists(boardId) {
  const exists = await prisma.board.findUnique({ where: { id: boardId }, select: { id: true } })
  if (!exists) {
    const err = new Error('Board not found.')
    err.status = 404
    throw err
  }
}

// GET /api/boards/:boardId/cards
export async function listCards(req, res, next) {
  try {
    await assertBoardExists(req.params.boardId)
    const cards = await prisma.card.findMany({
      where: { boardId: req.params.boardId },
      orderBy: ORDER,
      include: { _count: { select: { replies: true } } },
    })
    res.json(cards.map((c) => serializeCard(c, req.userId)))
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message })
    next(err)
  }
}

// POST /api/boards/:boardId/cards   (optionalAuth — guests allowed, spec §UA5)
// Any user (signed in or guest) can add a card to any board. Signed-in cards
// get stamped with the caller's id so they can delete them later; guest
// cards have userId=null and are undeletable via the API (no owner to match).
export async function createCard(req, res, next) {
  try {
    await assertBoardExists(req.params.boardId)
    const { message, gifUrl, author } = req.body
    const card = await prisma.card.create({
      data: {
        boardId: req.params.boardId,
        userId: req.userId ?? null,
        message: message.trim(),
        gifUrl: gifUrl.trim(),
        author: author?.trim() || null,
      },
    })
    res.status(201).json(serializeCard(card, req.userId))
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message })
    next(err)
  }
}

// DELETE /api/boards/:boardId/cards/:cardId   (auth required)
// Only the card's creator may delete it — being the board owner doesn't grant
// rights over other users' cards.
export async function deleteCard(req, res, next) {
  try {
    const { boardId, cardId } = req.params
    const card = await prisma.card.findFirst({
      where: { id: cardId, boardId },
      select: { userId: true },
    })
    if (!card) return res.status(404).json({ error: 'Card not found.' })
    if (card.userId !== req.userId) {
      return res.status(403).json({ error: 'Only the creator can delete this card.' })
    }

    await prisma.card.delete({ where: { id: cardId } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

// PATCH /api/boards/:boardId/cards/:cardId/upvote  → +1   (auth required, anyone)
export async function upvoteCard(req, res, next) {
  try {
    const { boardId, cardId } = req.params
    const existing = await prisma.card.findFirst({
      where: { id: cardId, boardId },
      select: { id: true },
    })
    if (!existing) return res.status(404).json({ error: 'Card not found.' })

    const card = await prisma.card.update({
      where: { id: cardId },
      data: { upvotes: { increment: 1 } },
      include: { _count: { select: { replies: true } } },
    })
    res.json(serializeCard(card, req.userId))
  } catch (err) {
    next(err)
  }
}

// PATCH /api/boards/:boardId/cards/:cardId/pin  body: { pinned: boolean }   (auth required)
// Only the board's creator may pin/unpin cards on their board.
export async function pinCard(req, res, next) {
  try {
    const { boardId, cardId } = req.params
    const { pinned } = req.body
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { userId: true },
    })
    if (!board) return res.status(404).json({ error: 'Board not found.' })
    if (board.userId !== req.userId) {
      return res.status(403).json({ error: 'Only the board owner can pin cards.' })
    }

    const existing = await prisma.card.findFirst({
      where: { id: cardId, boardId },
      select: { id: true },
    })
    if (!existing) return res.status(404).json({ error: 'Card not found.' })

    const card = await prisma.card.update({
      where: { id: cardId },
      data: { pinned, pinnedAt: pinned ? new Date() : null },
      include: { _count: { select: { replies: true } } },
    })
    res.json(serializeCard(card, req.userId))
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Card not found.' })
    }
    next(err)
  }
}
