import KudoCard from './KudoCard.jsx'
import BoardGridSkeleton from './BoardGridSkeleton.jsx'
import EmptyState from './EmptyState.jsx'
import './Grid.css'

// Grid of kudo cards. The parent passes cards already sorted (pinned first).
// `canPin` is true only for the board's owner, who alone may pin/unpin cards.
export default function CardGrid({ cards, loading, canPin = false, onDeleteCard, onUpvote, onPin, onAddCard }) {
  return (
    <div className="grid grid--cards">
      {loading ? (
        <BoardGridSkeleton count={6} />
      ) : cards.length === 0 ? (
        <EmptyState
          emoji="💌"
          title="No cards yet"
          message="Add the first kudos card to get this board going."
          actionLabel="Add Card"
          onAction={onAddCard}
        />
      ) : (
        cards.map((c) => (
          <KudoCard key={c.id} {...c} canPin={canPin} onUpvote={onUpvote} onPin={onPin} onDelete={onDeleteCard} />
        ))
      )}
    </div>
  )
}
