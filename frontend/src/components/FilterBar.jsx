import { FILTERS } from '../lib/categories.js'
import { PlusIcon } from './icons.jsx'
import './FilterBar.css'

// Category filter pills + the "Create New Board" entry point.
export default function FilterBar({ activeFilter, onFilterChange, onCreateBoard }) {
  return (
    <div className="filter-bar">
      <div className="filter-bar__pills" role="tablist" aria-label="Filter boards by category">
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

      <button className="filter-bar__create" onClick={onCreateBoard}>
        <PlusIcon width="18" height="18" />
        <span>Create New Board</span>
      </button>
    </div>
  )
}
