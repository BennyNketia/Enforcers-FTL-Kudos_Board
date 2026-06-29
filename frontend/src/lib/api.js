// ============================================================================
// Data layer.
//
// Two implementations behind one uniform interface (the `api` object below):
//   - HTTP (axios) when VITE_USE_API=true — talks to the Express + Prisma
//     backend (planning.md §2). Vite proxies /api to localhost:3001 in dev.
//   - localStorage fallback otherwise, so the UI is usable without a backend.
// Components consume `api.*` — they never see fetch/axios/storage details.
// ============================================================================

import axios from 'axios'
import { seedBoards, seedCards } from './seed.js'

const USE_API = import.meta.env.VITE_USE_API === 'true'
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

// One axios instance, base URL applied automatically. Keeps the per-call paths
// short and easy to compare against the contract in planning.md §2.
const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

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

// Carries the HTTP status so call sites can distinguish 404 from a transport error
// (see BoardDetailPage's `err?.status === 404` check).
class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function http(method, path, body) {
  try {
    const res = await client.request({ method, url: path, data: body })
    // 204 No Content → axios returns empty string; normalize to null.
    return res.status === 204 ? null : res.data
  } catch (err) {
    // The backend returns `{ error, details? }` (planning.md §2). Surface that.
    const status = err.response?.status ?? 0
    const message = err.response?.data?.error || err.message || 'Request failed'
    throw new ApiError(status, message)
  }
}

// Drop empty/undefined values so the URL stays clean (?filter=all stripped if 'all').
function cleanParams(params) {
  const out = {}
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') out[k] = v
  })
  return out
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
//
// Routes here mirror planning.md §2 — keep them in sync if either side changes.

export const api = {
  // GET /api/boards?filter&search
  getBoards: (opts) =>
    USE_API
      ? client.get('/boards', { params: cleanParams(opts) }).then((r) => r.data)
      : localGetBoards(opts),

  // GET /api/boards/:id
  getBoard: (id) => (USE_API ? http('GET', `/boards/${id}`) : localGetBoard(id)),

  // POST /api/boards   { title, category, imageUrl?, author? }
  createBoard: (data) =>
    USE_API ? http('POST', '/boards', data) : localCreateBoard(data),

  // DELETE /api/boards/:id   → 204
  deleteBoard: (id) =>
    USE_API ? http('DELETE', `/boards/${id}`) : localDeleteBoard(id),

  // GET /api/boards/:boardId/cards   (server pre-sorts: pinned-first)
  getCards: (boardId) =>
    USE_API ? http('GET', `/boards/${boardId}/cards`) : localGetCards(boardId),

  // POST /api/boards/:boardId/cards   { message, gifUrl, author? }
  createCard: (boardId, data) =>
    USE_API ? http('POST', `/boards/${boardId}/cards`, data) : localCreateCard(boardId, data),

  // DELETE /api/boards/:boardId/cards/:cardId   → 204
  deleteCard: (boardId, cardId) =>
    USE_API
      ? http('DELETE', `/boards/${boardId}/cards/${cardId}`)
      : localDeleteCard(boardId, cardId),

  // PATCH /api/boards/:boardId/cards/:cardId/upvote   (no body)
  upvoteCard: (boardId, cardId) =>
    USE_API
      ? http('PATCH', `/boards/${boardId}/cards/${cardId}/upvote`)
      : localUpvoteCard(boardId, cardId),

  // PATCH /api/boards/:boardId/cards/:cardId/pin   { pinned: boolean }
  pinCard: (boardId, cardId, pinned) =>
    USE_API
      ? http('PATCH', `/boards/${boardId}/cards/${cardId}/pin`, { pinned })
      : localPinCard(boardId, cardId, pinned),
}

export { defaultBoardImage, ApiError }
