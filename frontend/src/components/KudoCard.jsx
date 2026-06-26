import UpvoteButton from './UpvoteButton.jsx'
import { PinIcon, TrashIcon } from './icons.jsx'
import './KudoCard.css'

// A single appreciation card: GIF, message, author, upvote / pin / delete.
export default function KudoCard({
  id,
  message,
  gifUrl,
  author,
  upvotes,
  pinned,
  onUpvote,
  onPin,
  onDelete,
}) {
  return (
    <article className={`kudo-card${pinned ? ' kudo-card--pinned' : ''}`}>
      {pinned && <span className="kudo-card__pin-badge" aria-label="Pinned">📌</span>}

      {gifUrl && (
        <div className="kudo-card__media">
          <img src={gifUrl} alt="" loading="lazy" />
        </div>
      )}

      <div className="kudo-card__body">
        <p className="kudo-card__message t-body-md">{message}</p>
        <p className="kudo-card__author t-body-sm">{author ? `— ${author}` : '— Anonymous'}</p>
      </div>

      <div className="kudo-card__footer">
        <UpvoteButton count={upvotes} onUpvote={() => onUpvote?.(id)} />
        <div className="kudo-card__actions">
          <button
            className={`kudo-card__icon-btn${pinned ? ' kudo-card__icon-btn--pinned' : ''}`}
            onClick={() => onPin?.(id, !pinned)}
            aria-label={pinned ? 'Unpin card' : 'Pin card'}
            title={pinned ? 'Unpin' : 'Pin to top'}
          >
            <PinIcon filled={pinned} width="18" height="18" />
          </button>
          <button
            className="kudo-card__icon-btn kudo-card__icon-btn--danger"
            onClick={() => onDelete?.(id)}
            aria-label="Delete card"
            title="Delete"
          >
            <TrashIcon width="18" height="18" />
          </button>
        </div>
      </div>
    </article>
  )
}
