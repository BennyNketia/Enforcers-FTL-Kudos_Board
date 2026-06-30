// GIPHY controller — proxies search to GIPHY so the API key stays server-side.
//
// Wire format mirrors the frontend's expectation (frontend/src/lib/giphy.js):
//   GET /api/giphy/search?q=<terms>&limit=<n>  →  { gifs: [{ id, url, previewUrl }] }
// Errors flow through next(err) to the central handler in src/index.js.

import { searchGifs } from '../lib/giphy.js'

// GET /api/giphy/search?q&limit
// No `q` → the lib returns trending GIFs, so the picker shows a full grid on open.
export async function search(req, res, next) {
  try {
    // The lib trims `q` and clamps `limit`, so we forward both as-is.
    const gifs = await searchGifs(req.query.q, req.query.limit)
    res.json({ gifs })
  } catch (err) {
    next(err)
  }
}
