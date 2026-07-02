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

import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { serializeCard } from '../lib/serialize.js'

const ORDER = [
  { pinned: 'desc' },
  { pinnedAt: { sort: 'desc', nulls: 'last' } },
  { createdAt: 'desc' },
]

// Prisma `include` that attaches the reply count plus — when a user is signed
// in — that user's own like row for each card. serializeCard turns the scoped
// `likes` array into a boolean `liked`. For guests (userId undefined) we skip
// the relation entirely rather than filter on `userId: undefined`, which Prisma
// would treat as "no filter" and match every like.
function cardInclude(userId) {
  return {
    _count: { select: { replies: true } },
    ...(userId ? { likes: { where: { userId }, select: { userId: true } } } : {}),
  }
}

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
      include: cardInclude(req.userId),
    })
    res.json(cards.map((c) => serializeCard(c, req.userId)))
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message })
    next(err)
  }
}

// POST /api/boards/:boardId/cards   (optionalAuth — guests allowed, spec §UA5)
// Any user (signed in or guest) can add a card to any board. Signed-in cards
// are stamped with the caller's userId. Guest cards get a random `guestKey`
// that is echoed once in the response body; the creating browser stores it in
// localStorage and returns it in `X-Guest-Key` to authorize a later delete.
export async function createCard(req, res, next) {
  try {
    await assertBoardExists(req.params.boardId)
    const { message, gifUrl, author } = req.body
    const isGuest = !req.userId
    const guestKey = isGuest ? randomUUID() : null
    const card = await prisma.card.create({
      data: {
        boardId: req.params.boardId,
        userId: req.userId ?? null,
        guestKey,
        message: message?.trim() || null,
        gifUrl: gifUrl?.trim() || null,
        author: author?.trim() || null,
      },
    })
    // The serializer intentionally hides guestKey. Attach it only on the create
    // response (once, to the owning browser) so it can bank it for later delete.
    const body = serializeCard(card, req.userId)
    if (guestKey) body.guestKey = guestKey
    res.status(201).json(body)
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message })
    next(err)
  }
}

// DELETE /api/boards/:boardId/cards/:cardId   (optionalAuth)
// Two ways to authorize:
//   1. Signed-in creator: card.userId matches req.userId.
//   2. Guest creator: the browser that made the card presents its stored
//      `guestKey` in the X-Guest-Key header, matched against card.guestKey.
// Being the board owner does NOT grant delete rights over other users' cards.
export async function deleteCard(req, res, next) {
  try {
    const { boardId, cardId } = req.params
    const card = await prisma.card.findFirst({
      where: { id: cardId, boardId },
      select: { userId: true, guestKey: true },
    })
    if (!card) return res.status(404).json({ error: 'Card not found.' })

    const guestKey = req.get('x-guest-key') || null
    const isSignedInOwner = req.userId && card.userId === req.userId
    const isGuestOwner = card.guestKey && guestKey && guestKey === card.guestKey
    if (!isSignedInOwner && !isGuestOwner) {
      return res.status(403).json({ error: 'Only the creator can delete this card.' })
    }

    await prisma.card.delete({ where: { id: cardId } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

// PATCH /api/boards/:boardId/cards/:cardId/upvote   (auth required, anyone)
// Toggles the caller's upvote: like if they haven't, un-like if they have.
// One like per user is enforced by the CardLike composite PK; the `upvotes`
// counter is kept in sync inside a transaction so the two never drift.
export async function upvoteCard(req, res, next) {
  try {
    const { boardId, cardId } = req.params
    const userId = req.userId
    const existing = await prisma.card.findFirst({
      where: { id: cardId, boardId },
      select: { id: true },
    })
    if (!existing) return res.status(404).json({ error: 'Card not found.' })

    const like = await prisma.cardLike.findUnique({
      where: { userId_cardId: { userId, cardId } },
      select: { userId: true },
    })

    const card = await prisma.$transaction(async (tx) => {
      if (like) {
        await tx.cardLike.delete({ where: { userId_cardId: { userId, cardId } } })
        return tx.card.update({
          where: { id: cardId },
          data: { upvotes: { decrement: 1 } },
          include: cardInclude(userId),
        })
      }
      await tx.cardLike.create({ data: { userId, cardId } })
      return tx.card.update({
        where: { id: cardId },
        data: { upvotes: { increment: 1 } },
        include: cardInclude(userId),
      })
    })
    res.json(serializeCard(card, userId))
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
      include: cardInclude(req.userId),
    })
    res.json(serializeCard(card, req.userId))
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Card not found.' })
    }
    next(err)
  }
}
