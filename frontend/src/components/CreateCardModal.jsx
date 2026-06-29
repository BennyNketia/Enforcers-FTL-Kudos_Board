import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import GifPicker from './GifPicker.jsx'
import KudosComposer from './KudosComposer.jsx'

const EMPTY = { message: '', gifUrl: '', author: '' }

// Form dialog to add a card. Message + a selected GIF are required.
export default function CreateCardModal({ open, boardCategory, onClose, onCreate }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(EMPTY)
      setErrors({})
      setSubmitting(false)
    }
  }, [open])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  // The AI composer fills the message field; clear any stale message error.
  function handleComposed(message) {
    setForm((f) => ({ ...f, message }))
    setErrors((e) => ({ ...e, message: undefined }))
  }

  function validate() {
    const next = {}
    if (!form.message.trim()) next.message = 'A message is required.'
    if (!form.gifUrl) next.gifUrl = 'Please pick a GIF.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      await onCreate({
        message: form.message.trim(),
        gifUrl: form.gifUrl,
        author: form.author.trim(),
      })
      onClose()
    } catch (err) {
      setErrors({ form: err?.message || 'Something went wrong. Try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  // Create button accent follows the board's category.
  const accentClass = boardCategory ? `ui-btn--cat-${boardCategory}` : ''
  // Submit only enables once both required fields are satisfied.
  const canSubmit = form.message.trim() !== '' && form.gifUrl !== '' && !submitting

  return (
    <Modal open={open} title="Add a Kudos Card" onClose={onClose} maxWidth="36rem">
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <div className="field__label-row">
            <label className="field__label" htmlFor="card-message">
              Message<span className="req">*</span>
            </label>
            <KudosComposer onResult={handleComposed} />
          </div>
          <textarea
            id="card-message"
            className={`field__textarea${errors.message ? ' field__textarea--error' : ''}`}
            value={form.message}
            onChange={(e) => set('message', e.target.value)}
            placeholder="Write your kudos…"
            autoFocus
          />
          {errors.message && <span className="field__error">{errors.message}</span>}
        </div>

        <div className="field">
          <label className="field__label">
            Choose a GIF<span className="req">*</span>
          </label>
          <GifPicker selectedUrl={form.gifUrl} onSelect={(url) => set('gifUrl', url)} />
          {errors.gifUrl && <span className="field__error">{errors.gifUrl}</span>}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="card-author">Author (optional)</label>
          <input
            id="card-author"
            className="field__input"
            value={form.author}
            onChange={(e) => set('author', e.target.value)}
            placeholder="Your name"
          />
        </div>

        {errors.form && <p className="field__error" style={{ marginBottom: 'var(--space-3)' }}>{errors.form}</p>}

        <div className="modal-actions">
          <button type="submit" className={`ui-btn ui-btn--primary ${accentClass}`} disabled={!canSubmit}>
            {submitting && <span className="spinner" aria-hidden />}
            {submitting ? 'Adding…' : 'Add Card'}
          </button>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
