import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import BoardDetailHeader from '../components/BoardDetailHeader.jsx'
import CardGrid from '../components/CardGrid.jsx'
import CreateCardModal from '../components/CreateCardModal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { api } from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import './BoardDetailPage.css'

// Pinned first (newest pin first), then unpinned by newest created.
function sortCards(cards) {
  return [...cards].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (a.pinned && b.pinned) return (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0)
    return b.createdAt - a.createdAt
  })
}

export default function BoardDetailPage() {
  const { boardId } = useParams()
  // Refetch when auth changes — a guest viewing the admin's board should re-
  // resolve to a 404 if they sign in as someone who doesn't own it, and vice
  // versa. requireAuth gates any mutation (add/delete/upvote/pin) behind a
  // sign-in prompt for guests.
  const { user, requireAuth } = useAuth()
  const [board, setBoard] = useState(null)
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAddOpen, setIsAddOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [b, c] = await Promise.all([api.getBoard(boardId), api.getCards(boardId)])
      setBoard(b)
      setCards(sortCards(c))
    } catch (err) {
      setError(err?.status === 404 ? 'notfound' : err?.message || 'Failed to load board.')
    } finally {
      setLoading(false)
    }
  }, [boardId, user?.id])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(data) {
    const created = await api.createCard(boardId, data)
    setCards((prev) => sortCards([created, ...prev]))
  }

  // Guests are allowed to add cards (spec §UA5). No auth gate on this path —
  // the backend accepts optionalAuth and stamps the card as anonymous when
  // no token is present.
  function openAdd() {
    setIsAddOpen(true)
  }

  function handleDelete(id) {
    requireAuth(async () => {
      const prev = cards
      setCards((c) => c.filter((x) => x.id !== id))
      try {
        await api.deleteCard(boardId, id)
      } catch {
        setCards(prev)
      }
    })
  }

  function handleUpvote(id) {
    requireAuth(async () => {
      // Optimistic toggle: flip `liked` and nudge the count the matching way.
      // The server reconciles the exact numbers in its response.
      const prev = cards
      setCards((c) =>
        c.map((x) =>
          x.id === id ? { ...x, liked: !x.liked, upvotes: x.upvotes + (x.liked ? -1 : 1) } : x,
        ),
      )
      try {
        const updated = await api.upvoteCard(boardId, id)
        setCards((c) => c.map((x) => (x.id === id ? updated : x)))
      } catch {
        setCards(prev)
      }
    })
  }

  function handlePin(id, pinned) {
    requireAuth(async () => {
      const prev = cards
      // optimistic: apply + re-sort so it floats up / drops back immediately
      setCards((c) =>
        sortCards(c.map((x) => (x.id === id ? { ...x, pinned, pinnedAt: pinned ? Date.now() : null } : x))),
      )
      try {
        const updated = await api.pinCard(boardId, id, pinned)
        setCards((c) => sortCards(c.map((x) => (x.id === id ? updated : x))))
      } catch {
        setCards(prev)
      }
    })
  }

  if (error === 'notfound') {
    return (
      <div className="container board-detail">
        <EmptyState
          emoji="🤔"
          title="Board not found"
          message="This board may have been deleted."
          actionLabel="Back to all boards"
          onAction={() => (window.location.href = '/')}
        />
      </div>
    )
  }

  if (loading && !board) {
    return (
      <div className="container board-detail">
        <Link to="/" className="board-detail__back t-label">← All boards</Link>
        <CardGrid cards={[]} loading />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container board-detail">
        <p className="board-detail__error t-body-md">{error}</p>
      </div>
    )
  }

  return (
    <>
      <BoardDetailHeader board={board} cardCount={cards.length} onAddCard={openAdd} />
      <div className="container board-detail">
        <CardGrid
          cards={cards}
          loading={loading}
          canPin={Boolean(board?.isOwner)}
          onDeleteCard={handleDelete}
          onUpvote={handleUpvote}
          onPin={handlePin}
          onAddCard={openAdd}
        />
      </div>

      <CreateCardModal
        open={isAddOpen}
        boardCategory={board?.category}
        onClose={() => setIsAddOpen(false)}
        onCreate={handleCreate}
      />
    </>
  )
}
