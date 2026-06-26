import { useEffect, useRef, useState } from 'react'
import { searchGifs } from '../lib/giphy.js'
import { SearchIcon } from './icons.jsx'
import './GifPicker.css'

// Search GIPHY and select a GIF. Highlights the chosen one.
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
      </form>

      <div className="gif-picker__grid">
        {status === 'searching' && <p className="gif-picker__status t-body-sm">Searching…</p>}
        {status === 'error' && <p className="gif-picker__status t-body-sm">Couldn’t load GIFs. Try again.</p>}
        {status === 'results' && results.length === 0 && (
          <p className="gif-picker__status t-body-sm">No GIFs found.</p>
        )}
        {results.map((g) => {
          const selected = selectedUrl === g.url
          return (
            <button
              type="button"
              key={g.id}
              className={`gif-picker__item${selected ? ' gif-picker__item--selected' : ''}`}
              onClick={() => onSelect(g.url)}
              aria-pressed={selected}
            >
              <img src={g.previewUrl} alt="" loading="lazy" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
