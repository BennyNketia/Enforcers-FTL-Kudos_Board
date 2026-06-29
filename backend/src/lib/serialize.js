// Serializers for the wire format the frontend expects (planning.md Appendix B):
//   - createdAt / pinnedAt are epoch-millis NUMBERS, not ISO strings
//   - Board carries a derived `cardCount` from Prisma's `_count`
//
// Queries that include Board.cardCount should select `_count: { select: { cards: true } }`.

const ms = (d) => (d ? d.getTime() : null)

export function serializeBoard(board) {
  const cardCount = board._count?.cards ?? board.cardCount ?? 0
  return {
    id: board.id,
    title: board.title,
    category: board.category,
    imageUrl: board.imageUrl,
    author: board.author,
    createdAt: ms(board.createdAt),
    cardCount,
  }
}

export function serializeCard(card) {
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
  }
}
