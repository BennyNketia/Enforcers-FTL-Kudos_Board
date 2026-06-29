import { useEffect, useRef, useState } from 'react'
import { searchGifs } from '../lib/giphy.js'
import { SearchIcon, CheckIcon, ImageIcon } from './icons.jsx'
import './GifPicker.css'

// Search GIPHY and select a GIF. Shows loading / empty / error states and marks
// the chosen GIF with a checkmark overlay.
export default function GifPicker({ onSelect, selectedUrl }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle') // idle | searching | results | error
  const debounce = useRef()

  // Load some trending GIFs on first open.
  useEffect(() => {
    runSearch('')
    return () => clearTimeout(debounce.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runSearch(q) {
    setStatus('searching')
    try {
      const gifs = await searchGifs(q)
      setResults(gifs)
      setStatus('results')
    } catch {
      setStatus('error')
    }
  }

  function handleChange(e) {
    const next = e.target.value
    setQuery(next)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => runSearch(next), 350)
  }

  function handleSubmit(e) {
    e.preventDefault()
    clearTimeout(debounce.current)
    runSearch(query)
  }

  const showEmpty = status === 'results' && results.length === 0

  return (
    <div className="gif-picker">
      <form className="gif-picker__search" onSubmit={handleSubmit}>
        <span className="gif-picker__search-icon" aria-hidden><SearchIcon width="18" height="18" /></span>
        <input
          className="gif-picker__input"
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search GIPHY…"
          aria-label="Search GIFs"
        />
        {status === 'searching' && <span className="spinner gif-picker__spinner" aria-label="Searching" />}
      </form>

      <div className="gif-picker__grid" role="listbox" aria-label="GIF results">
        {status === 'error' && (
          <div className="gif-picker__status">
            <span className="gif-picker__status-icon" aria-hidden>😕</span>
            <p className="t-body-sm">Couldn’t load GIFs. Try again.</p>
          </div>
        )}
        {showEmpty && (
          <div className="gif-picker__status">
            <span className="gif-picker__status-icon" aria-hidden><ImageIcon width="28" height="28" /></span>
            <p className="t-body-sm">No GIFs found. Try another search.</p>
          </div>
        )}
        {status === 'searching' && results.length === 0 && (
          <div className="gif-picker__status">
            <span className="spinner" aria-hidden />
            <p className="t-body-sm">Searching GIPHY…</p>
          </div>
        )}
        {results.map((g) => {
          const selected = selectedUrl === g.url
          return (
            <button
              type="button"
              key={g.id}
              role="option"
              aria-selected={selected}
              className={`gif-picker__item${selected ? ' gif-picker__item--selected' : ''}`}
              onClick={() => onSelect(g.url)}
            >
              <img src={g.previewUrl} alt="" loading="lazy" />
              {selected && (
                <span className="gif-picker__check" aria-hidden>
                  <CheckIcon width="16" height="16" />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
