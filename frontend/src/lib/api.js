// ============================================================================
// Data layer.
//
// The Express + Prisma backend (see planning.md §2) isn't built yet, so this
// module implements the SAME contract against localStorage. Method signatures
// and return shapes match the API, so swapping to fetch() later touches ONLY
// this file — components consume these functions, not storage details.
//
// To switch to the real API: set VITE_USE_API=true and the http* paths run.
// ============================================================================

import { seedBoards, seedCards } from './seed.js'

const USE_API = import.meta.env.VITE_USE_API === 'true'
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

const BOARDS_KEY = 'kudos-boards'
const CARDS_KEY = 'kudos-cards'

// ---- local storage helpers -------------------------------------------------

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function ensureSeeded() {
  if (localStorage.getItem(BOARDS_KEY) === null) write(BOARDS_KEY, seedBoards())
  if (localStorage.getItem(CARDS_KEY) === null) write(CARDS_KEY, seedCards())
}

function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Attach derived cardCount, just like the API does.
function withCardCount(board, cards) {
  return { ...board, cardCount: cards.filter((c) => c.boardId === board.id).length }
}

// Pinned first (most recently pinned first), then newest created first.
function sortCards(cards) {
  return [...cards].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (a.pinned && b.pinned) return (b.pinnedAt ?? 0) - (a.pinnedAt ?? 0)
    return b.createdAt - a.createdAt
  })
}

// ---- Boards ----------------------------------------------------------------

async function localGetBoards({ filter = 'all', search = '' } = {}) {
  ensureSeeded()
  const cards = read(CARDS_KEY, [])
  let boards = read(BOARDS_KEY, []).map((b) => withCardCount(b, cards))

  if (search.trim()) {
    const q = search.trim().toLowerCase()
    boards = boards.filter((b) => b.title.toLowerCase().includes(q))
  }

  boards.sort((a, b) => b.createdAt - a.createdAt)

  if (filter === 'recent') return boards.slice(0, 6)
  if (filter && filter !== 'all') return boards.filter((b) => b.category === filter)
  return boards
}

async function localGetBoard(boardId) {
  ensureSeeded()
  const cards = read(CARDS_KEY, [])
  const board = read(BOARDS_KEY, []).find((b) => b.id === boardId)
  if (!board) throw new ApiError(404, 'Board not found')
  return withCardCount(board, cards)
}

async function localCreateBoard({ title, category, imageUrl, author }) {
  ensureSeeded()
  const board = {
    id: uuid(),
    title: title.trim(),
    category,
    imageUrl: imageUrl?.trim() || defaultBoardImage(category),
    author: author?.trim() || '',
    createdAt: Date.now(),
  }
  const boards = read(BOARDS_KEY, [])
  write(BOARDS_KEY, [board, ...boards])
  return { ...board, cardCount: 0 }
}

async function localDeleteBoard(boardId) {
  ensureSeeded()
  write(BOARDS_KEY, read(BOARDS_KEY, []).filter((b) => b.id !== boardId))
  // cascade delete cards
  write(CARDS_KEY, read(CARDS_KEY, []).filter((c) => c.boardId !== boardId))
}

// ---- Cards -----------------------------------------------------------------

async function localGetCards(boardId) {
  ensureSeeded()
  return sortCards(read(CARDS_KEY, []).filter((c) => c.boardId === boardId))
}

async function localCreateCard(boardId, { message, gifUrl, author }) {
  ensureSeeded()
  const card = {
    id: uuid(),
    boardId,
    message: message.trim(),
    gifUrl,
    author: author?.trim() || '',
    upvotes: 0,
    pinned: false,
    pinnedAt: null,
    createdAt: Date.now(),
  }
  write(CARDS_KEY, [...read(CARDS_KEY, []), card])
  return card
}

async function localDeleteCard(boardId, cardId) {
  ensureSeeded()
  write(CARDS_KEY, read(CARDS_KEY, []).filter((c) => c.id !== cardId))
}

function mutateCard(cardId, fn) {
  const cards = read(CARDS_KEY, [])
  const idx = cards.findIndex((c) => c.id === cardId)
  if (idx === -1) throw new ApiError(404, 'Card not found')
  cards[idx] = fn(cards[idx])
  write(CARDS_KEY, cards)
  return cards[idx]
}

async function localUpvoteCard(boardId, cardId) {
  ensureSeeded()
  return mutateCard(cardId, (c) => ({ ...c, upvotes: c.upvotes + 1 }))
}

async function localPinCard(boardId, cardId, pinned) {
  ensureSeeded()
  return mutateCard(cardId, (c) => ({
    ...c,
    pinned,
    pinnedAt: pinned ? Date.now() : null,
  }))
}

// ---- HTTP implementation (used when VITE_USE_API=true) ---------------------

class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function http(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data?.error || res.statusText)
  return data
}

function qs(params) {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, v)
  })
  const s = sp.toString()
  return s ? `?${s}` : ''
}

// ---- default cover image per category -------------------------------------

function defaultBoardImage(category) {
  const map = {
    celebration: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&q=80',
    thankyou: 'https://images.unsplash.com/photo-1606857521015-7f9fcf423740?w=800&q=80',
    inspiration: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=800&q=80',
  }
  return map[category] || map.celebration
}

// ---- public API (uniform regardless of backend) ---------------------------

export const api = {
  getBoards: (opts) =>
    USE_API ? http('GET', `/boards${qs(opts || {})}`) : localGetBoards(opts),
  getBoard: (id) => (USE_API ? http('GET', `/boards/${id}`) : localGetBoard(id)),
  createBoard: (data) =>
    USE_API ? http('POST', '/boards', data) : localCreateBoard(data),
  deleteBoard: (id) =>
    USE_API ? http('DELETE', `/boards/${id}`) : localDeleteBoard(id),

  getCards: (boardId) =>
    USE_API ? http('GET', `/boards/${boardId}/cards`) : localGetCards(boardId),
  createCard: (boardId, data) =>
    USE_API ? http('POST', `/boards/${boardId}/cards`, data) : localCreateCard(boardId, data),
  deleteCard: (boardId, cardId) =>
    USE_API
      ? http('DELETE', `/boards/${boardId}/cards/${cardId}`)
      : localDeleteCard(boardId, cardId),
  upvoteCard: (boardId, cardId) =>
    USE_API
      ? http('PATCH', `/boards/${boardId}/cards/${cardId}/upvote`)
      : localUpvoteCard(boardId, cardId),
  pinCard: (boardId, cardId, pinned) =>
    USE_API
      ? http('PATCH', `/boards/${boardId}/cards/${cardId}/pin`, { pinned })
      : localPinCard(boardId, cardId, pinned),
}

export { defaultBoardImage }
