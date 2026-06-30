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

  // Empty query → omit `q`; both the proxy and GIPHY's trending endpoint return
  // a full grid in that case.
  const url = USE_API
    ? `${API_BASE}/giphy/search?${q ? `q=${encodeURIComponent(q)}&limit=${limit}` : `limit=${limit}`}`
    : q
      ? `https://api.giphy.com/v1/gifs/search?api_key=${PUBLIC_KEY}&q=${encodeURIComponent(q)}&limit=${limit}&rating=pg`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${PUBLIC_KEY}&limit=${limit}&rating=pg`

  let res
  try {
    res = await fetch(url)
  } catch {
    // Only a TRUE network failure (offline, server unreachable) lands here —
    // fetch doesn't reject on 4xx/5xx. Keep the picker usable with demo GIFs.
    return DEMO_GIFS
  }

  // A reached-but-failing endpoint (e.g. backend missing GIPHY_API_KEY → 500,
  // or GIPHY rate-limiting → 429) must SURFACE, not masquerade as demo results.
  // The GifPicker catches this and shows its error state.
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error || `GIF search failed (${res.status}).`)
  }

  const data = await res.json()
  if (USE_API) return data.gifs ?? []
  return (data.data ?? []).map((g) => ({
    id: g.id,
    url: g.images?.original?.url,
    previewUrl: g.images?.fixed_width?.url || g.images?.original?.url,
  }))
}
