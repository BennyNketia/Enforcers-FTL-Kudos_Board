import { useState } from 'react'
import { composeKudos, TONES } from '../lib/ai.js'
import { SparkleIcon } from './icons.jsx'
import './KudosComposer.css'

// "Help me write" — AI kudos composer. Lives inside CreateCardModal, above the
// message field. The user types a few keywords + picks a tone; we draft a
// message and hand it up via onResult so the parent fills the message field.
// They can regenerate or just edit the result by hand afterward.
export default function KudosComposer({ onResult }) {
  const [open, setOpen] = useState(false)
  const [keywords, setKeywords] = useState('')
  const [tone, setTone] = useState('heartfelt')
  const [status, setStatus] = useState('idle') // idle | loading | error
  const [error, setError] = useState('')

  async function generate() {
    if (!keywords.trim() || status === 'loading') return
    setStatus('loading')
    setError('')
    try {
      const message = await composeKudos({ keywords: keywords.trim(), tone })
      onResult(message)
      setStatus('idle')
    } catch (err) {
      setError(err?.message || 'Something went wrong. Try again.')
      setStatus('error')
    }
  }

  function handleKeyDown(e) {
    // Enter generates; Shift+Enter makes a newline. (This is a textarea.)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      generate()
    }
  }

  const loading = status === 'loading'

  if (!open) {
    return (
      <button type="button" className="composer-trigger" onClick={() => setOpen(true)}>
        <SparkleIcon width="16" height="16" />
        <span>Help me write</span>
      </button>
    )
  }

  return (
    <div className="composer">
      <div className="composer__head">
        <span className="composer__title">
          <SparkleIcon width="15" height="15" /> AI assist
        </span>
        <button type="button" className="composer__hide" onClick={() => setOpen(false)}>
          Hide
        </button>
      </div>

      <textarea
        className="composer__input"
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="A few notes… e.g. “Sarah, covered my weekend shift, total lifesaver”"
        rows={2}
        disabled={loading}
      />

      <div className="composer__tones" role="group" aria-label="Tone">
        {TONES.map((t) => (
          <button
            type="button"
            key={t.key}
            className={`composer__tone${tone === t.key ? ' composer__tone--active' : ''}`}
            onClick={() => setTone(t.key)}
            disabled={loading}
            aria-pressed={tone === t.key}
          >
            <span aria-hidden>{t.emoji}</span> {t.label}
          </button>
        ))}
      </div>

      {error && <p className="composer__error">{error}</p>}

      <button
        type="button"
        className="ui-btn ui-btn--primary ui-btn--sm ui-btn--block composer__go"
        onClick={generate}
        disabled={loading || !keywords.trim()}
      >
        {loading ? (
          <>
            <span className="spinner" aria-hidden /> Writing…
          </>
        ) : (
          <>
            <SparkleIcon width="16" height="16" /> Generate message
          </>
        )}
      </button>
    </div>
  )
}
