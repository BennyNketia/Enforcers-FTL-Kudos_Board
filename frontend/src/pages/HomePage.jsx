import { useCallback, useEffect, useState } from 'react'
import Banner from '../components/Banner.jsx'
import FilterBar from '../components/FilterBar.jsx'
import SearchBar from '../components/SearchBar.jsx'
import BoardGrid from '../components/BoardGrid.jsx'
import CreateBoardModal from '../components/CreateBoardModal.jsx'
import { api } from '../lib/api.js'
import './HomePage.css'

export default function HomePage() {
  const [boards, setBoards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  // Fetch boards whenever filter or committed search changes (server-side filtering).
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
  }, [activeFilter, searchQuery])

  useEffect(() => {
    load()
  }, [load])

  async function handleCreate(data) {
    const created = await api.createBoard(data)
    // Reflect immediately if it belongs in the current view, else just refetch.
    if (activeFilter === 'all' || activeFilter === 'recent' || activeFilter === created.category) {
      setBoards((prev) => [created, ...prev])
    }
  }

  async function handleDelete(id) {
    const prev = boards
    setBoards((b) => b.filter((x) => x.id !== id)) // optimistic
    try {
      await api.deleteBoard(id)
    } catch {
      setBoards(prev) // rollback
    }
  }

  const isFiltered = activeFilter !== 'all' || searchQuery.trim() !== ''

  return (
    <>
      <Banner />
      <div className="container home">
        <section className="home__controls">
          <FilterBar
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            onCreateBoard={() => setIsCreateOpen(true)}
          />
          <SearchBar
            value={searchQuery}
            onSubmit={(q) => setSearchQuery(q)}
            onClear={() => setSearchQuery('')}
          />
        </section>

        {error && <p className="home__error t-body-md">{error}</p>}

        <BoardGrid
          boards={boards}
          loading={loading}
          onDeleteBoard={handleDelete}
          onCreateBoard={() => setIsCreateOpen(true)}
          isFiltered={isFiltered}
        />
      </div>

      <CreateBoardModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreate}
      />
    </>
  )
}
