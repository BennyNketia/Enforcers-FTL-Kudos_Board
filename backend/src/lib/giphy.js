// ============================================================================
// GIPHY client — the single place that talks to GIPHY.
//
// Mirrors lib/openrouter.js: the API key is read from process.env and stays
// server-side, so it is never shipped to the browser. The frontend hits our
// proxy (GET /api/giphy/search); we forward to GIPHY with the key attached and
// return a trimmed-down shape the GifPicker can render directly.
// ============================================================================

const GIPHY_SEARCH_URL = 'https://api.giphy.com/v1/gifs/search'
const REQUEST_TIMEOUT_MS = 10_000

// Thrown when no GIPHY key is set. The route layer turns this into a clean 500
// with a helpful message instead of a stack trace.
export class GiphyNotConfiguredError extends Error {
  constructor() {
    super('GIPHY is not configured. Add GIPHY_API_KEY to backend/.env and restart the server.')
    this.name = 'GiphyNotConfiguredError'
  }
}

export function isConfigured() {
  return Boolean(process.env.GIPHY_API_KEY)
}

/**
 * Search GIPHY and return a compact list of GIFs.
 * @param {string} query   search terms
 * @param {number} [limit] how many results (1–50)
 * @returns {Promise<Array<{ id: string, url: string, previewUrl: string }>>}
 */
export async function searchGifs(query, limit = 12) {
  if (!isConfigured()) throw new GiphyNotConfiguredError()

  // Clamp limit to GIPHY's accepted range so a bad query param can't break the call.
  const safeLimit = Math.min(Math.max(Number(limit) || 12, 1), 50)

  // URLSearchParams handles encoding (spaces, &, etc.) so we don't build URLs by hand.
  const params = new URLSearchParams({
    api_key: process.env.GIPHY_API_KEY,
    q: query,
    limit: String(safeLimit),
    rating: 'pg',
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(`${GIPHY_SEARCH_URL}?${params}`, { signal: controller.signal })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      const err = new Error(`GIPHY responded ${res.status}: ${detail.slice(0, 200)}`)
      err.status = res.status
      throw err
    }

    const data = await res.json()
    // GIPHY returns a big object per GIF; the picker only needs id + two urls.
    return (data.data ?? []).map((g) => ({
      id: g.id,
      url: g.images?.original?.url,
      previewUrl: g.images?.fixed_width?.url || g.images?.original?.url,
    }))
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('The GIPHY request timed out. Try again.')
    throw err
  } finally {
    clearTimeout(timeout)
  }
}
