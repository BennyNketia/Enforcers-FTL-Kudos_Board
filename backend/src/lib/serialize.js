// Serializers for the wire format the frontend expects (planning.md Appendix B):
//   - createdAt / pinnedAt are epoch-millis NUMBERS, not ISO strings
//   - Board carries a derived `cardCount` from Prisma's `_count`
//   - Both Board and Card carry a derived `isOwner` boolean so the frontend
//     can hide delete buttons without leaking the row's userId
//
// Queries that include Board.cardCount should select `_count: { select: { cards: true } }`.

const ms = (d) => (d ? d.getTime() : null)

export function serializeBoard(board, currentUserId) {
  const cardCount = board._count?.cards ?? board.cardCount ?? 0
  return {
    id: board.id,
    title: board.title,
    category: board.category,
    imageUrl: board.imageUrl,
    author: board.author,
    createdAt: ms(board.createdAt),
    cardCount,
    isOwner: Boolean(currentUserId && board.userId === currentUserId),
  }
}

export function serializeCard(card, currentUserId) {
  const replyCount = card._count?.replies ?? card.replyCount ?? 0
  return {
    id: card.id,
    boardId: card.boardId,
    message: card.message,
    gifUrl: card.gifUrl,
    author: card.author,
    upvotes: card.upvotes,
    pinned: card.pinned,
    pinnedAt: ms(card.pinnedAt),
    createdAt: ms(card.createdAt),
    replyCount,
    isOwner: Boolean(currentUserId && card.userId === currentUserId),
  }
}

// A reply to a card: text + optional GIF + a `likes` counter. Like cards, it
// carries `isOwner` so the frontend can hide the delete button for non-owners.
export function serializeReply(reply, currentUserId) {
  return {
    id: reply.id,
    cardId: reply.cardId,
    message: reply.message,
    gifUrl: reply.gifUrl,
    author: reply.author,
    likes: reply.likes,
    createdAt: ms(reply.createdAt),
    isOwner: Boolean(currentUserId && reply.userId === currentUserId),
  }
}
