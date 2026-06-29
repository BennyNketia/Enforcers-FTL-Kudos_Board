// Cards controllers — planning.md §2.2.
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
    })
    res.json(cards.map(serializeCard))
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message })
    next(err)
  }
}

// POST /api/boards/:boardId/cards
export async function createCard(req, res, next) {
  try {
    await assertBoardExists(req.params.boardId)
    const { message, gifUrl, author } = req.body
    const card = await prisma.card.create({
      data: {
        boardId: req.params.boardId,
        message: message.trim(),
        gifUrl: gifUrl.trim(),
        author: author?.trim() || null,
      },
    })
    res.status(201).json(serializeCard(card))
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message })
    next(err)
  }
}

// DELETE /api/boards/:boardId/cards/:cardId
export async function deleteCard(req, res, next) {
  try {
    const { boardId, cardId } = req.params
    const result = await prisma.card.deleteMany({ where: { id: cardId, boardId } })
    if (result.count === 0) return res.status(404).json({ error: 'Card not found.' })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

// PATCH /api/boards/:boardId/cards/:cardId/upvote  → +1
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
    })
    res.json(serializeCard(card))
  } catch (err) {
    next(err)
  }
}

// PATCH /api/boards/:boardId/cards/:cardId/pin  body: { pinned: boolean }
export async function pinCard(req, res, next) {
  try {
    const { boardId, cardId } = req.params
    const { pinned } = req.body
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
