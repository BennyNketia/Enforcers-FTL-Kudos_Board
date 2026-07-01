import { FILTERS } from '../lib/categories.js'
import { useAuth } from '../hooks/useAuth.js'
import './FilterBar.css'

// Category filter pills. Filters marked `authOnly: true` (currently just
// 'My boards') are hidden for guests.
export default function FilterBar({ activeFilter, onFilterChange }) {
  const { user } = useAuth()
  const visible = FILTERS.filter((f) => !f.authOnly || user)

  return (
    <div className="filter-bar" role="tablist" aria-label="Filter boards by category">
      {visible.map((f) => {
        const active = activeFilter === f.key
        return (
          <button
            key={f.key}
            role="tab"
            aria-selected={active}
            className={`pill pill--${f.key}${active ? ' pill--active' : ''}`}
            onClick={() => onFilterChange(f.key)}
          >
            {f.label}
          </button>
        )
      })}
    </div>
  )
}
