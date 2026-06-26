import { Link } from 'react-router-dom'
import CategoryTag from './CategoryTag.jsx'
import { ArrowLeftIcon, PlusIcon } from './icons.jsx'
import './BoardDetailHeader.css'

// Board page header: back link, title + category chip, and Add Card button.
// Background is a soft gradient themed to the board's category.
export default function BoardDetailHeader({ board, onAddCard }) {
  return (
    <header className={`board-header board-header--${board.category}`}>
      <div className="container board-header__inner">
        <Link to="/" className="board-header__back t-label">
          <ArrowLeftIcon width="18" height="18" />
          <span>All boards</span>
        </Link>

        <div className="board-header__row">
          <div className="board-header__titles">
            <h1 className="board-header__title t-h1">{board.title}</h1>
            <div className="board-header__meta">
              <CategoryTag category={board.category} />
              {board.author && <span className="t-body-sm board-header__author">by {board.author}</span>}
            </div>
          </div>

          <button className="board-header__add" onClick={onAddCard}>
            <PlusIcon width="18" height="18" />
            <span>Add Card</span>
          </button>
        </div>
      </div>
    </header>
  )
}
