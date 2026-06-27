import { FILTERS } from '../lib/categories.js'
import './FilterBar.css'

// Category filter pills. Create-board lives in the header / section head now,
// so this is a pure controlled filter group.
export default function FilterBar({ activeFilter, onFilterChange }) {
  return (
    <div className="filter-bar" role="tablist" aria-label="Filter boards by category">
      {FILTERS.map((f) => {
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
