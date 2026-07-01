import { useState } from 'react'
import GifPicker from './GifPicker.jsx'
import { ImageIcon, CloseIcon } from './icons.jsx'

// Inline composer for replying to a card. Message is required; a GIF is
// optional and revealed on demand so the common text-only reply stays compact.
// Rendered outside any parent <form>, so a real <form> + Enter-to-submit is safe
// here (unlike GifPicker inside CreateCardModal).
export default function ReplyComposer({ onSubmit, onCancel }) {
  const [message, setMessage] = useState('')
  const [gifUrl, setGifUrl] = useState('')
  const [showGif, setShowGif] = useState(false)
  const [author, setAuthor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = message.trim() !== '' && !submitting

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({ message: message.trim(), gifUrl, author: author.trim() })
      // Parent collapses the composer on success; reset just in case it stays.
      setMessage('')
      setGifUrl('')
      setShowGif(false)
      setAuthor('')
    } catch (err) {
      setError(err?.message || 'Could not post your reply. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="reply-composer" onSubmit={handleSubmit}>
      <textarea
        className="reply-composer__input"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Write a reply…"
        rows={2}
        autoFocus
      />

      <input
        className="reply-composer__author"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Your name (optional)"
      />

      {showGif ? (
        <div className="reply-composer__gif">
          <GifPicker selectedUrl={gifUrl} onSelect={setGifUrl} message={message} />
          <button
            type="button"
            className="reply-composer__gif-toggle"
            onClick={() => {
              setShowGif(false)
              setGifUrl('')
            }}
          >
            <CloseIcon width="14" height="14" /> Remove GIF
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="reply-composer__gif-toggle"
          onClick={() => setShowGif(true)}
        >
          <ImageIcon width="14" height="14" /> Add a GIF
        </button>
      )}

      {error && <span className="reply-composer__error field__error">{error}</span>}

      <div className="reply-composer__actions">
        <button type="submit" className="ui-btn ui-btn--primary reply-composer__submit" disabled={!canSubmit}>
          {submitting && <span className="spinner" aria-hidden />}
          {submitting ? 'Posting…' : 'Reply'}
        </button>
        <button type="button" className="ui-btn ui-btn--ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
      </div>
    </form>
  )
}
