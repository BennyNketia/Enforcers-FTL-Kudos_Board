import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons.jsx'
import './Modal.css'

// Reusable modal shell: overlay + card + header. Closes on overlay click and Esc.
export default function Modal({ open, title, onClose, children, maxWidth = '28rem' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-card__header">
          <h2 className="t-h3">{title}</h2>
          <button className="modal-card__close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-card__body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
