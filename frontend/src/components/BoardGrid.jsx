import BoardCard from './BoardCard.jsx'
import BoardGridSkeleton from './BoardGridSkeleton.jsx'
import EmptyState from './EmptyState.jsx'
import './Grid.css'

// Renders boards, a loading skeleton, or an empty state — all in the same grid.
export default function BoardGrid({ boards, loading, onDeleteBoard, onCreateBoard, isFiltered }) {
  return (
    <div className="grid grid--boards">
      {loading ? (
        <BoardGridSkeleton count={8} />
      ) : boards.length === 0 ? (
        <EmptyState
          emoji={isFiltered ? '🔍' : '🗂️'}
          title={isFiltered ? 'No boards match' : 'No boards yet'}
          message={
            isFiltered
              ? 'Try a different category or clear your search.'
              : 'Create your first board to start collecting kudos.'
          }
          actionLabel={isFiltered ? undefined : 'Create New Board'}
          onAction={isFiltered ? undefined : onCreateBoard}
        />
      ) : (
        boards.map((b) => <BoardCard key={b.id} {...b} onDelete={onDeleteBoard} />)
      )}
    </div>
  )
}
