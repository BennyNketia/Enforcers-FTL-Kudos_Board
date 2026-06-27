import { useEffect, useState } from 'react'
import { SearchIcon, CloseIcon } from './icons.jsx'
import './SearchBar.css'

// Title search. Submits on Enter or the search button; clearing all text (or
// the × button) tells the parent to show all boards again.
export default function SearchBar({ value, onChange, onSubmit, onClear, placeholder = 'Search boards by title…' }) {
  // Local draft so typing doesn't refetch on every keystroke — we commit on submit.
  const [draft, setDraft] = useState(value ?? '')

  // Keep the draft in sync when the parent resets the committed value
  // (e.g. a Quick Action jumps to a filter and clears the search).
  useEffect(() => {
    setDraft(value ?? '')
  }, [value])

  function handleChange(e) {
    const next = e.target.value
    setDraft(next)
    onChange?.(next)
    // Clearing the field restores the full list immediately.
    if (next === '') onClear?.()
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit?.(draft.trim())
  }

  function handleClear() {
    setDraft('')
    onClear?.()
  }

  return (
    <form className="search-bar" role="search" onSubmit={handleSubmit}>
      <span className="search-bar__icon" aria-hidden>
        <SearchIcon />
      </span>
      <input
        className="search-bar__input t-body-md"
        type="text"
        value={draft}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label="Search boards by title"
      />
      {draft && (
        <button type="button" className="search-bar__clear" onClick={handleClear} aria-label="Clear search">
          <CloseIcon width="18" height="18" />
        </button>
      )}
      <button type="submit" className="search-bar__submit">Search</button>
    </form>
  )
}
