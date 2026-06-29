import { Link } from 'react-router-dom'
import CategoryTag from './CategoryTag.jsx'
import { ArrowLeftIcon, PlusIcon, LayersIcon } from './icons.jsx'
import './BoardDetailHeader.css'

function initialOf(name) {
  const t = (name || '').trim()
  return t ? t[0].toUpperCase() : '🙂'
}

// Board page header: a cover banner using the board's image with a dark gradient
// overlay, with the back link, category chip, title, author, card count, and the
// Add Card button laid over it — so the page reads as a real board, not a blank
// area. Falls back to a category gradient when no cover image exists.
export default function BoardDetailHeader({ board, cardCount, onAddCard }) {
  const count = typeof cardCount === 'number' ? cardCount : board.cardCount ?? 0

  return (
    <header className={`board-header board-header--${board.category}${board.imageUrl ? ' board-header--has-cover' : ''}`}>
      {board.imageUrl && (
        <div className="board-header__cover" aria-hidden>
          <img src={board.imageUrl} alt="" />
          <span className="board-header__scrim" />
        </div>
      )}

      <div className="container board-header__inner">
        <Link to="/" className="board-header__back t-label">
          <ArrowLeftIcon width="18" height="18" />
          <span>All boards</span>
        </Link>

        <div className="board-header__row">
          <div className="board-header__titles">
            <CategoryTag category={board.category} />
            <h1 className="board-header__title t-display-lg">{board.title}</h1>
            <div className="board-header__meta">
              <span className="board-header__author">
                <span className="avatar board-header__avatar" aria-hidden>{initialOf(board.author)}</span>
                {board.author ? `by ${board.author}` : 'Anonymous'}
              </span>
              <span className="count-badge board-header__count">
                <LayersIcon width="14" height="14" />
                {count} {count === 1 ? 'card' : 'cards'}
              </span>
            </div>
          </div>

          <button className="ui-btn ui-btn--primary board-header__add" onClick={onAddCard}>
            <PlusIcon width="18" height="18" />
            <span>Add Card</span>
          </button>
        </div>
      </div>
    </header>
  )
}
