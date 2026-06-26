import './EmptyState.css'

export default function EmptyState({ emoji = '🗂️', title, message, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <div className="empty-state__emoji" aria-hidden>{emoji}</div>
      {title && <h3 className="empty-state__title t-h3">{title}</h3>}
      {message && <p className="empty-state__message t-body-md">{message}</p>}
      {actionLabel && onAction && (
        <button className="empty-state__action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
