import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { BOARD_CATEGORIES } from '../lib/categories.js'

const EMPTY = { title: '', category: '', imageUrl: '', author: '' }

// Form dialog to create a board. Title + category are required.
export default function CreateBoardModal({ open, onClose, onCreate }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  // Reset whenever the modal is (re)opened.
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

  function validate() {
    const next = {}
    if (!form.title.trim()) next.title = 'Title is required.'
    if (!form.category) next.category = 'Please pick a category.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      await onCreate({
        title: form.title.trim(),
        category: form.category,
        imageUrl: form.imageUrl.trim(),
        author: form.author.trim(),
      })
      onClose()
    } catch (err) {
      setErrors({ form: err?.message || 'Something went wrong. Try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} title="Create New Board" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="board-title">
            Title<span className="req">*</span>
          </label>
          <input
            id="board-title"
            className={`field__input${errors.title ? ' field__input--error' : ''}`}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Q2 Launch Wins"
            autoFocus
          />
          {errors.title && <span className="field__error">{errors.title}</span>}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="board-category">
            Category<span className="req">*</span>
          </label>
          <select
            id="board-category"
            className={`field__select${errors.category ? ' field__input--error' : ''}`}
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
          >
            <option value="" disabled>Choose a category…</option>
            {BOARD_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.emoji} {c.label}
              </option>
            ))}
          </select>
          {errors.category && <span className="field__error">{errors.category}</span>}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="board-image">Image URL (optional)</label>
          <input
            id="board-image"
            className="field__input"
            value={form.imageUrl}
            onChange={(e) => set('imageUrl', e.target.value)}
            placeholder="https://…  (leave blank for a default cover)"
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="board-author">Author (optional)</label>
          <input
            id="board-author"
            className="field__input"
            value={form.author}
            onChange={(e) => set('author', e.target.value)}
            placeholder="Your name"
          />
        </div>

        {errors.form && <p className="field__error" style={{ marginBottom: 'var(--space-3)' }}>{errors.form}</p>}

        <div className="modal-actions">
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Board'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  )
}
