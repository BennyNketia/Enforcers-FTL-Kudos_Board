import { useEffect, useRef, useState } from 'react'
import { searchGifs } from '../lib/giphy.js'
import { suggestGifTerms } from '../lib/ai.js'
import { SearchIcon, CheckIcon, ImageIcon, SparkleIcon } from './icons.jsx'
import './GifPicker.css'

// Search GIPHY and select a GIF. Shows loading / empty / error states and marks
// the chosen GIF with a checkmark overlay. When a `message` is provided, offers
// AI-suggested search terms (chips) that run a search when clicked.
export default function GifPicker({ onSelect, selectedUrl, message = '' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle') // idle | searching | results | error
  const [terms, setTerms] = useState([])
  const [suggesting, setSuggesting] = useState(false)
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

  // Ask the AI for search terms that match the kudos message's vibe.
  async function getSuggestions() {
    if (!message.trim() || suggesting) return
    setSuggesting(true)
    try {
      setTerms(await suggestGifTerms(message.trim()))
    } catch {
      setTerms([]) // Fail quietly — the manual search box still works.
    } finally {
      setSuggesting(false)
    }
  }

  // Clicking a suggested term fills the search box and runs it immediately.
  function useTerm(term) {
    setQuery(term)
    clearTimeout(debounce.current)
    runSearch(term)
  }

  function handleSubmit(e) {
    e.preventDefault()
    clearTimeout(debounce.current)
    runSearch(query)
  }

  const showEmpty = status === 'results' && results.length === 0

  return (
    <div className="gif-picker">
      {message.trim() && (
        <div className="gif-picker__suggest">
          <button
            type="button"
            className="gif-picker__suggest-btn"
            onClick={getSuggestions}
            disabled={suggesting}
          >
            {suggesting ? (
              <><span className="spinner" aria-hidden /> Thinking…</>
            ) : (
              <><SparkleIcon width="14" height="14" /> Suggest GIFs</>
            )}
          </button>
          {terms.map((term) => (
            <button
              type="button"
              key={term}
              className="gif-picker__term"
              onClick={() => useTerm(term)}
            >
              {term}
            </button>
          ))}
        </div>
      )}

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
