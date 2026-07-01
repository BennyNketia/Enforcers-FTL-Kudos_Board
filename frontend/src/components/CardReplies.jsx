import { useState } from 'react'
import ReplyComposer from './ReplyComposer.jsx'
import { api } from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import { ChatIcon, HeartIcon, TrashIcon } from './icons.jsx'
import './CardReplies.css'

function initialOf(name) {
  const t = (name || '').trim()
  return t ? t[0].toUpperCase() : '🙂'
}

// Threaded replies under a single kudo card. Self-contained: lazily loads its
// own replies the first time the thread is expanded, then owns that list. All
// mutations are gated behind requireAuth() (the shared sign-in prompt) and
// applied optimistically, matching how cards behave on the board page.
export default function CardReplies({ boardId, cardId, replyCount = 0, onCountChange }) {
  const { requireAuth } = useAuth()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [replies, setReplies] = useState([])
  const [composing, setComposing] = useState(false)

  // Keep the toggle label honest before the thread has ever been opened.
  const count = loaded ? replies.length : replyCount

  async function ensureLoaded() {
    if (loaded || loading) return
    setLoading(true)
    try {
      const data = await api.getReplies(boardId, cardId)
      setReplies(data)
      setLoaded(true)
    } catch {
      // Leave unloaded so the next expand retries.
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) ensureLoaded()
  }

  function startReply() {
    requireAuth(() => {
      setOpen(true)
      ensureLoaded()
      setComposing(true)
    })
  }

  async function handleCreate(data) {
    // ReplyComposer awaits this; let it surface errors via its catch.
    const created = await api.createReply(boardId, cardId, data)
    setReplies((prev) => [...prev, created])
    setComposing(false)
    onCountChange?.(replies.length + 1)
  }

  function handleLike(id) {
    requireAuth(async () => {
      setReplies((rs) => rs.map((r) => (r.id === id ? { ...r, likes: r.likes + 1 } : r)))
      try {
        const updated = await api.likeReply(boardId, cardId, id)
        setReplies((rs) => rs.map((r) => (r.id === id ? updated : r)))
      } catch {
        setReplies((rs) => rs.map((r) => (r.id === id ? { ...r, likes: r.likes - 1 } : r)))
      }
    })
  }

  function handleDelete(id) {
    requireAuth(async () => {
      const prev = replies
      const next = replies.filter((r) => r.id !== id)
      setReplies(next)
      onCountChange?.(next.length)
      try {
        await api.deleteReply(boardId, cardId, id)
      } catch {
        setReplies(prev)
        onCountChange?.(prev.length)
      }
    })
  }

  return (
    <div className="card-replies">
      <button
        type="button"
        className="card-replies__toggle"
        onClick={toggle}
        aria-expanded={open}
      >
        <ChatIcon width="16" height="16" />
        {count > 0 ? `${count} ${count === 1 ? 'reply' : 'replies'}` : 'Reply'}
      </button>

      {open && (
        <div className="card-replies__panel">
          {loading && replies.length === 0 && (
            <p className="card-replies__status t-body-sm">Loading replies…</p>
          )}

          {loaded && replies.length === 0 && !composing && (
            <p className="card-replies__status t-body-sm">No replies yet. Be the first!</p>
          )}

          {replies.map((r) => (
            <div key={r.id} className="reply">
              <span className="avatar reply__avatar" aria-hidden>{initialOf(r.author)}</span>
              <div className="reply__body">
                <div className="reply__head">
                  <span className="reply__author t-body-sm">{r.author ? r.author : 'Anonymous'}</span>
                </div>
                {r.message && <p className="reply__message t-body-sm">{r.message}</p>}
                {r.gifUrl && (
                  <div className="reply__media">
                    <img src={r.gifUrl} alt="" loading="lazy" />
                  </div>
                )}
                <div className="reply__footer">
                  <button
                    type="button"
                    className="reply__like"
                    onClick={() => handleLike(r.id)}
                    aria-label={`Like (${r.likes})`}
                  >
                    <HeartIcon filled={r.likes > 0} width="14" height="14" />
                    <span>{r.likes}</span>
                  </button>
                  {r.isOwner && (
                    <button
                      type="button"
                      className="reply__delete"
                      onClick={() => handleDelete(r.id)}
                      aria-label="Delete reply"
                      title="Delete"
                    >
                      <TrashIcon width="14" height="14" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {composing ? (
            <ReplyComposer onSubmit={handleCreate} onCancel={() => setComposing(false)} />
          ) : (
            <button type="button" className="card-replies__add" onClick={startReply}>
              <ChatIcon width="14" height="14" /> Add a reply
            </button>
          )}
        </div>
      )}
    </div>
  )
}
