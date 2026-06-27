// AI client for the "Help me write" composer.
//
// Always routes through the backend proxy (POST /api/ai/compose) so the
// OpenRouter key stays server-side (planning.md §2.3 / §7). In dev, Vite proxies
// /api → localhost:3001 (see vite.config.js), so this works without extra setup
// once the backend is running with OPENROUTER_API_KEY in backend/.env.

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

// Tone options shown in the composer. Keys must match the backend's TONES map.
export const TONES = [
  { key: 'heartfelt', label: 'Heartfelt', emoji: '💛' },
  { key: 'funny', label: 'Funny', emoji: '😄' },
  { key: 'professional', label: 'Professional', emoji: '💼' },
  { key: 'poetic', label: 'Poetic', emoji: '🪶' },
  { key: 'hype', label: 'Hype', emoji: '🔥' },
]

/**
 * Draft a kudos message from keywords + a tone.
 * @param {{ keywords: string, tone?: string, recipient?: string }} params
 * @returns {Promise<string>} the drafted message
 */
export async function composeKudos({ keywords, tone = 'heartfelt', recipient = '' }) {
  const res = await fetch(`${API_BASE}/ai/compose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keywords, tone, recipient }),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error || 'Couldn’t generate a message. Try again.')
  }
  return data.message
}
