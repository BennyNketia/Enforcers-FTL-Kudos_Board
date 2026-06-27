import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CategoryTag from './CategoryTag.jsx'
import { TrashIcon, LayersIcon } from './icons.jsx'
import './BoardCard.css'

// Initial for the author avatar (falls back to a person glyph).
function initialOf(name) {
  const t = (name || '').trim()
  return t ? t[0].toUpperCase() : '🙂'
}

// A board tile on the home page. The whole card navigates to the board; the
// corner delete button stops propagation so it never triggers navigation.
// `featured` renders a taller cover for the Highlighted Boards strip.
export default function BoardCard({
  id,
  title,
  category,
  imageUrl,
  author,
  cardCount,
  onDelete,
  featured = false,
}) {
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)

  function handleDelete(e) {
    e.stopPropagation()
    setDeleting(true)
    onDelete?.(id)
  }

  function open() {
    navigate(`/boards/${id}`)
  }

  return (
    <article
      className={`board-card${featured ? ' board-card--featured' : ''}${deleting ? ' board-card--deleting' : ''}`}
      onClick={open}
      role="button"
      tabIndex={0}
      aria-label={`Open board ${title}`}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open())}
    >
      <div className="board-card__media">
        <img src={imageUrl} alt="" loading="lazy" />
        <div className="board-card__overlay" aria-hidden />
        <div className="board-card__media-top">
          <CategoryTag category={category} />
          {typeof cardCount === 'number' && (
            <span className="board-card__count">
              <LayersIcon width="13" height="13" />
              {cardCount}
            </span>
          )}
        </div>
        <button
          className="board-card__delete"
          onClick={handleDelete}
          aria-label={`Delete board ${title}`}
          title="Delete board"
        >
          <TrashIcon width="17" height="17" />
        </button>
      </div>

      <div className="board-card__body">
        <h3 className={`board-card__title ${featured ? 't-h3' : 't-h4'}`}>{title}</h3>
        <div className="board-card__meta">
          <span className="avatar board-card__avatar" aria-hidden>{initialOf(author)}</span>
          <span className="board-card__author t-body-sm">{author ? author : 'Anonymous'}</span>
        </div>
      </div>
    </article>
  )
}
