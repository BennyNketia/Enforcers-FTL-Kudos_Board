import './BoardGridSkeleton.css'

// Shimmer placeholders matching the card layout. Reused for boards and cards.
export default function BoardGridSkeleton({ count = 8 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div className="skeleton-card" key={i} aria-hidden>
          <div className="skeleton-card__media" />
          <div className="skeleton-card__body">
            <div className="skeleton-line skeleton-line--tag" />
            <div className="skeleton-line skeleton-line--title" />
            <div className="skeleton-line skeleton-line--author" />
          </div>
        </div>
      ))}
    </>
  )
}
