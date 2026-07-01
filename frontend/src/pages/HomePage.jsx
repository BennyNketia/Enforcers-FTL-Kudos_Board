import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Hero from '../components/Hero.jsx'
import FilterBar from '../components/FilterBar.jsx'
import SearchBar from '../components/SearchBar.jsx'
import BoardGrid from '../components/BoardGrid.jsx'
import CreateBoardModal from '../components/CreateBoardModal.jsx'
import { api } from '../lib/api.js'
import { useAuth } from '../hooks/useAuth.js'
import './HomePage.css'

const WEEK = 7 * 24 * 60 * 60 * 1000

export default function HomePage() {
  // user?.id flows into the dep arrays of load/loadAll so the grid refetches
  // when someone logs in or out — each user's view is scoped server-side.
  // requireAuth gates create/delete actions behind a sign-in prompt for guests.
  const { user, requireAuth } = useAuth()
  const [boards, setBoards] = useState([])
  const [allBoards, setAllBoards] = useState([]) // unfiltered — powers stats + highlights
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const allBoardsRef = useRef(null)

  // Header / hero "Create" deep-links here with ?new=1 — gate behind auth,
  // then strip the param so a refresh doesn't reopen it.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      requireAuth(() => setIsCreateOpen(true))
      searchParams.delete('new')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams, requireAuth])

  // Main grid: server-side filter + search.
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getBoards({ filter: activeFilter, search: searchQuery })
      setBoards(data)
    } catch (err) {
      setError(err?.message || 'Failed to load boards.')
    } finally {
      setLoading(false)
    }
  }, [activeFilter, searchQuery, user?.id])

  // Unfiltered snapshot for hero stats + highlighted strip.
  const loadAll = useCallback(async () => {
    try {
      setAllBoards(await api.getBoards({ filter: 'all' }))
    } catch {
      /* stats are best-effort; the grid surfaces real errors */
    }
  }, [user?.id])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadAll() }, [loadAll])

  // If the user logs out while viewing "My boards" (guest-hidden pill),
  // fall back to 'all' so they aren't stuck on an empty, invisible filter.
  useEffect(() => {
    if (activeFilter === 'mine' && !user) setActiveFilter('all')
  }, [user, activeFilter])

  const stats = useMemo(() => {
    const now = Date.now()
    return {
      boards: allBoards.length,
      cards: allBoards.reduce((sum, b) => sum + (b.cardCount || 0), 0),
      recent: allBoards.filter((b) => now - b.createdAt < WEEK).length,
    }
  }, [allBoards])

  async function handleCreate(data) {
    const created = await api.createBoard(data)
    // Match the server's filter to decide whether the new board should appear
    // in the currently-visible grid. 'mine' always includes it — the creator
    // is by definition the owner.
    const includes =
      activeFilter === 'all' ||
      activeFilter === 'recent' ||
      activeFilter === 'mine' ||
      activeFilter === created.category
    if (includes) setBoards((prev) => [created, ...prev])
    setAllBoards((prev) => [created, ...prev])
  }

  function handleDelete(id) {
    requireAuth(async () => {
      const prev = boards
      const prevAll = allBoards
      setBoards((b) => b.filter((x) => x.id !== id)) // optimistic
      setAllBoards((b) => b.filter((x) => x.id !== id))
      try {
        await api.deleteBoard(id)
      } catch {
        setBoards(prev)
        setAllBoards(prevAll)
      }
    })
  }

  // Open the create-board modal only if signed in; guests get the auth modal
  // instead, and the create modal pops automatically after they sign in.
  function openCreate() {
    requireAuth(() => setIsCreateOpen(true))
  }

  const isFiltered = activeFilter !== 'all' || searchQuery.trim() !== ''

  return (
    <>
      <Hero stats={stats} loading={loading && allBoards.length === 0} onPrimary={openCreate} />

      <div className="container home stack">
        <section id="all-boards" className="home__all" ref={allBoardsRef}>
          <div className="section-head">
            <div className="section-head__titles">
              <h2 className="section-head__title t-h2">All boards</h2>
              <p className="section-head__sub t-body-md">Filter by category or search by title.</p>
            </div>
          </div>

          <div className="home__toolbar">
            <FilterBar activeFilter={activeFilter} onFilterChange={setActiveFilter} />
            <SearchBar
              value={searchQuery}
              onSubmit={(q) => setSearchQuery(q)}
              onClear={() => setSearchQuery('')}
            />
          </div>

          {error && <p className="home__error t-body-md">{error}</p>}

          <BoardGrid
            boards={boards}
            loading={loading}
            onDeleteBoard={handleDelete}
            onCreateBoard={openCreate}
            isFiltered={isFiltered}
          />
        </section>
      </div>

      <CreateBoardModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreate}
      />
    </>
  )
}
