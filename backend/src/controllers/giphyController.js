// GIPHY controller — proxies search to GIPHY so the API key stays server-side.
//
// Wire format mirrors the frontend's expectation (frontend/src/lib/giphy.js):
//   GET /api/giphy/search?q=<terms>&limit=<n>  →  { gifs: [{ id, url, previewUrl }] }
// Errors flow through next(err) to the central handler in src/index.js.

import { searchGifs } from '../lib/giphy.js'

// GET /api/giphy/search?q&limit
export async function search(req, res, next) {
  try {
    const q = (req.query.q || '').trim()
    if (!q) return res.status(400).json({ error: 'A search query (q) is required.' })

    // The lib clamps `limit` to GIPHY's valid range, so we forward it as-is.
    const gifs = await searchGifs(q, req.query.limit)
    res.json({ gifs })
  } catch (err) {
    next(err)
  }
}
