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

// Attach the JWT (set by lib/auth.js on login) so the backend can scope
// requests to the current user. Read on each request so logout / login takes
// effect immediately without rebuilding the axios instance.
const TOKEN_KEY = 'kudos-auth-token'
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Guest-owned cards: the browser holds a per-card secret handed back by the
// server at create time. Presenting it in `X-Guest-Key` lets a guest delete
// their own anonymous card without an account. Map is `{ [cardId]: guestKey }`.
const GUEST_KEYS_KEY = 'kudos-guest-card-keys'
function readGuestKeys() {
  try { return JSON.parse(localStorage.getItem(GUEST_KEYS_KEY) || '{}') }
  catch { return {} }
}
function stashGuestKey(cardId, key) {
  const map = readGuestKeys()
  map[cardId] = key
  localStorage.setItem(GUEST_KEYS_KEY, JSON.stringify(map))
}
function dropGuestKey(cardId) {
  const map = readGuestKeys()
  if (map[cardId]) {
    delete map[cardId]
    localStorage.setItem(GUEST_KEYS_KEY, JSON.stringify(map))
  }
}
export function getGuestKey(cardId) {
  return readGuestKeys()[cardId] || null
}
// Server-side isOwner only knows about signed-in creators. A guest is the
// owner of a card iff we have its guestKey stashed locally. Callers OR this
// onto the wire value before deciding whether to render a delete button.
export function isGuestOwned(cardId) {
  return Boolean(readGuestKeys()[cardId])
}

const BOARDS_KEY = 'kudos-boards'
const CARDS_KEY = 'kudos-cards'
const REPLIES_KEY = 'kudos-replies'
// Per-user like records, mirroring the backend's CardLike / ReplyLike join
// tables: each entry is { userId, cardId } / { userId, replyId }. Presence of a
// row = that user liked that target, which enforces one-like-per-user and lets
// us stamp a `liked` flag onto served cards/replies.
const CARD_LIKES_KEY = 'kudos-card-likes'
const REPLY_LIKES_KEY = 'kudos-reply-likes'
// Where lib/auth.js persists the local "session" — used to attribute likes to
// the current user. Kept in sync with auth.js's SESSION_KEY.
const SESSION_KEY = 'kudos-auth-user'

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
  if (localStorage.getItem(REPLIES_KEY) === null) write(REPLIES_KEY, [])
  if (localStorage.getItem(CARD_LIKES_KEY) === null) write(CARD_LIKES_KEY, [])
  if (localStorage.getItem(REPLY_LIKES_KEY) === null) write(REPLY_LIKES_KEY, [])
}

// Id of the locally signed-in user, or null. Likes are attributed to this id so
// the "one like per user" rule matches the backend. Falls back to a stable
// 'guest' bucket when no one is signed in — good enough for the offline demo.
function currentUserId() {
  return read(SESSION_KEY, null)?.id ?? 'guest'
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

// Attach derived replyCount + the current user's `liked` flag, just like the API.
function withReplyCount(card, replies, cardLikes = read(CARD_LIKES_KEY, [])) {
  const uid = currentUserId()
  return {
    ...card,
    replyCount: replies.filter((r) => r.cardId === card.id).length,
    liked: cardLikes.some((l) => l.cardId === card.id && l.userId === uid),
  }
}

async function localGetCards(boardId) {
  ensureSeeded()
  const replies = read(REPLIES_KEY, [])
  const cardLikes = read(CARD_LIKES_KEY, [])
  const cards = read(CARDS_KEY, [])
    .filter((c) => c.boardId === boardId)
    .map((c) => withReplyCount(c, replies, cardLikes))
  return sortCards(cards)
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
  return { ...card, replyCount: 0, liked: false }
}

async function localDeleteCard(boardId, cardId) {
  ensureSeeded()
  write(CARDS_KEY, read(CARDS_KEY, []).filter((c) => c.id !== cardId))
  // cascade delete replies
  write(REPLIES_KEY, read(REPLIES_KEY, []).filter((r) => r.cardId !== cardId))
}

function mutateCard(cardId, fn) {
  const cards = read(CARDS_KEY, [])
  const idx = cards.findIndex((c) => c.id === cardId)
  if (idx === -1) throw new ApiError(404, 'Card not found')
  cards[idx] = fn(cards[idx])
  write(CARDS_KEY, cards)
  // Keep replyCount in sync so the returned card doesn't drop its badge.
  return withReplyCount(cards[idx], read(REPLIES_KEY, []))
}

// Toggle the current user's upvote (mirrors the backend). Liking adds a like
// record and bumps the count; clicking again removes both.
async function localUpvoteCard(boardId, cardId) {
  ensureSeeded()
  const uid = currentUserId()
  const likes = read(CARD_LIKES_KEY, [])
  const alreadyLiked = likes.some((l) => l.cardId === cardId && l.userId === uid)

  write(
    CARD_LIKES_KEY,
    alreadyLiked
      ? likes.filter((l) => !(l.cardId === cardId && l.userId === uid))
      : [...likes, { userId: uid, cardId }],
  )
  return mutateCard(cardId, (c) => ({ ...c, upvotes: c.upvotes + (alreadyLiked ? -1 : 1) }))
}

async function localPinCard(boardId, cardId, pinned) {
  ensureSeeded()
  return mutateCard(cardId, (c) => ({
    ...c,
    pinned,
    pinnedAt: pinned ? Date.now() : null,
  }))
}

// ---- Replies ---------------------------------------------------------------

// Conversation order: oldest reply first.
function sortReplies(replies) {
  return [...replies].sort((a, b) => a.createdAt - b.createdAt)
}

// Stamp each reply with the current user's `liked` flag, mirroring the API.
function withReplyLiked(reply, replyLikes = read(REPLY_LIKES_KEY, []), uid = currentUserId()) {
  return { ...reply, liked: replyLikes.some((l) => l.replyId === reply.id && l.userId === uid) }
}

async function localGetReplies(boardId, cardId) {
  ensureSeeded()
  const replyLikes = read(REPLY_LIKES_KEY, [])
  const uid = currentUserId()
  return sortReplies(
    read(REPLIES_KEY, [])
      .filter((r) => r.cardId === cardId)
      .map((r) => withReplyLiked(r, replyLikes, uid)),
  )
}

async function localCreateReply(boardId, cardId, { message, gifUrl, author }) {
  ensureSeeded()
  const reply = {
    id: uuid(),
    cardId,
    message: message.trim(),
    gifUrl: gifUrl?.trim() || '',
    author: author?.trim() || '',
    likes: 0,
    createdAt: Date.now(),
  }
  write(REPLIES_KEY, [...read(REPLIES_KEY, []), reply])
  return { ...reply, liked: false }
}

async function localDeleteReply(boardId, cardId, replyId) {
  ensureSeeded()
  write(REPLIES_KEY, read(REPLIES_KEY, []).filter((r) => r.id !== replyId))
}

// Toggle the current user's like on a reply (mirrors the backend).
async function localLikeReply(boardId, cardId, replyId) {
  ensureSeeded()
  const uid = currentUserId()
  const likes = read(REPLY_LIKES_KEY, [])
  const alreadyLiked = likes.some((l) => l.replyId === replyId && l.userId === uid)

  write(
    REPLY_LIKES_KEY,
    alreadyLiked
      ? likes.filter((l) => !(l.replyId === replyId && l.userId === uid))
      : [...likes, { userId: uid, replyId }],
  )

  const replies = read(REPLIES_KEY, [])
  const idx = replies.findIndex((r) => r.id === replyId)
  if (idx === -1) throw new ApiError(404, 'Reply not found')
  replies[idx] = { ...replies[idx], likes: replies[idx].likes + (alreadyLiked ? -1 : 1) }
  write(REPLIES_KEY, replies)
  return withReplyLiked(replies[idx], read(REPLY_LIKES_KEY, []), uid)
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
  // A guest response includes a one-time `guestKey`; we stash it in localStorage
  // so this browser can later delete the card. Strip it before handing the card
  // to callers so it never leaks into React state / the DOM.
  createCard: (boardId, data) => {
    if (!USE_API) return localCreateCard(boardId, data)
    return http('POST', `/boards/${boardId}/cards`, data).then((card) => {
      if (card?.guestKey) {
        stashGuestKey(card.id, card.guestKey)
        const { guestKey: _drop, ...clean } = card
        return clean
      }
      return card
    })
  },

  // DELETE /api/boards/:boardId/cards/:cardId   → 204
  // Sends X-Guest-Key when we've stashed one for this card (guest-created).
  deleteCard: (boardId, cardId) => {
    if (!USE_API) return localDeleteCard(boardId, cardId)
    const guestKey = getGuestKey(cardId)
    const headers = guestKey ? { 'X-Guest-Key': guestKey } : {}
    return client
      .delete(`/boards/${boardId}/cards/${cardId}`, { headers })
      .then((res) => {
        dropGuestKey(cardId)
        return res.status === 204 ? null : res.data
      })
      .catch((err) => {
        const status = err.response?.status ?? 0
        const message = err.response?.data?.error || err.message || 'Request failed'
        throw new ApiError(status, message)
      })
  },

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

  // GET /api/boards/:boardId/cards/:cardId/replies   (oldest first)
  getReplies: (boardId, cardId) =>
    USE_API
      ? http('GET', `/boards/${boardId}/cards/${cardId}/replies`)
      : localGetReplies(boardId, cardId),

  // POST /api/boards/:boardId/cards/:cardId/replies   { message, gifUrl?, author? }
  createReply: (boardId, cardId, data) =>
    USE_API
      ? http('POST', `/boards/${boardId}/cards/${cardId}/replies`, data)
      : localCreateReply(boardId, cardId, data),

  // DELETE /api/boards/:boardId/cards/:cardId/replies/:replyId   → 204
  deleteReply: (boardId, cardId, replyId) =>
    USE_API
      ? http('DELETE', `/boards/${boardId}/cards/${cardId}/replies/${replyId}`)
      : localDeleteReply(boardId, cardId, replyId),

  // PATCH /api/boards/:boardId/cards/:cardId/replies/:replyId/like   (no body)
  likeReply: (boardId, cardId, replyId) =>
    USE_API
      ? http('PATCH', `/boards/${boardId}/cards/${cardId}/replies/${replyId}/like`)
      : localLikeReply(boardId, cardId, replyId),
}

export { defaultBoardImage, ApiError }
