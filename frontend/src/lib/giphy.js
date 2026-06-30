// GIPHY search for the GifPicker.
//
// Preferred: route through the backend proxy (GET /api/giphy/search) so the API
// key stays server-side (planning.md §2.3). Until that exists, we fall back to
// the public beta key directly, or — if neither is available — to a small set of
// curated demo GIFs so the picker still works offline.

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'
const USE_API = import.meta.env.VITE_USE_API === 'true'
// GIPHY's well-known public beta key; replace with your own via env in prod.
const PUBLIC_KEY = import.meta.env.VITE_GIPHY_KEY || 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65'

const DEMO_GIFS = [
  { id: 'd1', url: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif', previewUrl: 'https://media.giphy.com/media/g9582DNuQppxC/200w.gif' },
  { id: 'd2', url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif', previewUrl: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/200w.gif' },
  { id: 'd3', url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif', previewUrl: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200w.gif' },
  { id: 'd4', url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif', previewUrl: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/200w.gif' },
  { id: 'd5', url: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif', previewUrl: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/200w.gif' },
  { id: 'd6', url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif', previewUrl: 'https://media.giphy.com/media/111ebonMs90YLu/200w.gif' },
]

export async function searchGifs(query, limit = 24) {
  const q = query.trim()

  try {
    if (USE_API) {
      // Empty query → omit `q`; the proxy returns trending GIFs in that case.
      const qs = q ? `q=${encodeURIComponent(q)}&limit=${limit}` : `limit=${limit}`
      const res = await fetch(`${API_BASE}/giphy/search?${qs}`)
      if (!res.ok) throw new Error('proxy failed')
      const data = await res.json()
      return data.gifs ?? []
    }

    // No query → show trending GIFs (a full grid) instead of a search.
    const url = q
      ? `https://api.giphy.com/v1/gifs/search?api_key=${PUBLIC_KEY}&q=${encodeURIComponent(q)}&limit=${limit}&rating=pg`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${PUBLIC_KEY}&limit=${limit}&rating=pg`
    const res = await fetch(url)
    if (!res.ok) throw new Error('giphy failed')
    const data = await res.json()
    return (data.data ?? []).map((g) => ({
      id: g.id,
      url: g.images?.original?.url,
      previewUrl: g.images?.fixed_width?.url || g.images?.original?.url,
    }))
  } catch {
    // Offline / rate-limited: keep the picker usable with demo GIFs.
    return DEMO_GIFS
  }
}
