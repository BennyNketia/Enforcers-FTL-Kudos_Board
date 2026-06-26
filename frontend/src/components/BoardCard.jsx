import { useNavigate } from 'react-router-dom'
import CategoryTag from './CategoryTag.jsx'
import { TrashIcon } from './icons.jsx'
import './BoardCard.css'

// A single board tile on the home page.
export default function BoardCard({ id, title, category, imageUrl, author, cardCount, onDelete }) {
  const navigate = useNavigate()

  function handleDelete(e) {
    e.stopPropagation()
    onDelete?.(id)
  }

  function open() {
    navigate(`/boards/${id}`)
  }

  return (
    <article
      className="board-card"
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && open()}
    >
      <div className="board-card__media">
        <img src={imageUrl} alt="" loading="lazy" />
      </div>
      <div className="board-card__body">
        <CategoryTag category={category} />
        <h3 className="board-card__title t-h4">{title}</h3>
        <p className="board-card__meta t-body-sm">
          {author ? `by ${author}` : 'Anonymous'}
          {typeof cardCount === 'number' && ` · ${cardCount} ${cardCount === 1 ? 'card' : 'cards'}`}
        </p>
      </div>
      <div className="board-card__footer">
        <button
          className="board-card__delete"
          onClick={handleDelete}
          aria-label={`Delete board ${title}`}
          title="Delete board"
        >
          <TrashIcon width="18" height="18" />
        </button>
      </div>
    </article>
  )
}
