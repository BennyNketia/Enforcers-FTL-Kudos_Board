// Replies controllers — replies hang off a single card (planning.md §2.2).
//
// Visibility model mirrors cards: every reply is globally readable; mutations
// require auth. Anyone signed in can reply to any card and like any reply; only
// the reply's creator may delete it. Each serialized reply carries an `isOwner`
// flag so the frontend can hide the delete button for non-owners.
//
// Ordering: replies read oldest-first (a conversation thread), unlike cards.

import { prisma } from '../lib/prisma.js'
import { serializeReply } from '../lib/serialize.js'

// When a user is signed in, attach that user's own like row for each reply so
// serializeReply can expose a boolean `liked`. Skipped for guests — filtering
// on `userId: undefined` would match every like (see cardsController).
function replyInclude(userId) {
  return userId ? { likedBy: { where: { userId }, select: { userId: true } } } : {}
}

// Throws 404 if the parent card (scoped to its board) is missing. Used by every
// /boards/:boardId/cards/:cardId/replies route.
async function assertCardExists(boardId, cardId) {
  const exists = await prisma.card.findFirst({
    where: { id: cardId, boardId },
    select: { id: true },
  })
  if (!exists) {
    const err = new Error('Card not found.')
    err.status = 404
    throw err
  }
}

// GET /api/boards/:boardId/cards/:cardId/replies
export async function listReplies(req, res, next) {
  try {
    const { boardId, cardId } = req.params
    await assertCardExists(boardId, cardId)
    const replies = await prisma.reply.findMany({
      where: { cardId },
      orderBy: { createdAt: 'asc' },
      include: replyInclude(req.userId),
    })
    res.json(replies.map((r) => serializeReply(r, req.userId)))
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message })
    next(err)
  }
}

// POST /api/boards/:boardId/cards/:cardId/replies   (auth required by route)
// Any signed-in user can reply to any card. The reply is stamped with the
// caller's id so they (and only they) can delete it later. Either message or
// gifUrl must be present (validator enforces this); a reply may be text-only,
// GIF-only, or both.
export async function createReply(req, res, next) {
  try {
    const { boardId, cardId } = req.params
    await assertCardExists(boardId, cardId)
    const { message, gifUrl, author } = req.body
    const reply = await prisma.reply.create({
      data: {
        cardId,
        userId: req.userId,
        message: message?.trim() || '',
        gifUrl: gifUrl?.trim() || null,
        author: author?.trim() || null,
      },
    })
    res.status(201).json(serializeReply(reply, req.userId))
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message })
    next(err)
  }
}

// DELETE /api/boards/:boardId/cards/:cardId/replies/:replyId   (auth required)
// Only the reply's creator may delete it.
export async function deleteReply(req, res, next) {
  try {
    const { cardId, replyId } = req.params
    const reply = await prisma.reply.findFirst({
      where: { id: replyId, cardId },
      select: { userId: true },
    })
    if (!reply) return res.status(404).json({ error: 'Reply not found.' })
    if (reply.userId !== req.userId) {
      return res.status(403).json({ error: 'Only the creator can delete this reply.' })
    }

    await prisma.reply.delete({ where: { id: replyId } })
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

// PATCH /api/boards/:boardId/cards/:cardId/replies/:replyId/like   (auth required, anyone)
// Toggles the caller's like: like if they haven't, un-like if they have. One
// like per user is enforced by the ReplyLike composite PK; the `likes` counter
// is kept in sync inside a transaction so the two never drift.
export async function likeReply(req, res, next) {
  try {
    const { cardId, replyId } = req.params
    const userId = req.userId
    const existing = await prisma.reply.findFirst({
      where: { id: replyId, cardId },
      select: { id: true },
    })
    if (!existing) return res.status(404).json({ error: 'Reply not found.' })

    const like = await prisma.replyLike.findUnique({
      where: { userId_replyId: { userId, replyId } },
      select: { userId: true },
    })

    const reply = await prisma.$transaction(async (tx) => {
      if (like) {
        await tx.replyLike.delete({ where: { userId_replyId: { userId, replyId } } })
        return tx.reply.update({
          where: { id: replyId },
          data: { likes: { decrement: 1 } },
          include: replyInclude(userId),
        })
      }
      await tx.replyLike.create({ data: { userId, replyId } })
      return tx.reply.update({
        where: { id: replyId },
        data: { likes: { increment: 1 } },
        include: replyInclude(userId),
      })
    })
    res.json(serializeReply(reply, userId))
  } catch (err) {
    next(err)
  }
}
