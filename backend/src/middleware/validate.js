// Request-body validation middleware.
//
// Each function builds the error envelope from planning.md §2:
//   { error: "Human-readable message", details: { field: "reason" } }
// and short-circuits with 400 on failure. Controllers stay focused on DB work.

const CATEGORIES = ['celebration', 'thankyou', 'inspiration']
// 'mine' scopes the result to req.userId; the controller ignores it if the
// caller is a guest (no session), so the query param is always safe to send.
const FILTERS = ['all', 'recent', 'mine', ...CATEGORIES]

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

// POST /api/boards — title + category required; category must be a known value.
export function validateCreateBoard(req, res, next) {
  const body = req.body || {}
  const details = {}

  if (!isNonEmptyString(body.title)) details.title = 'Title is required.'
  if (!isNonEmptyString(body.category)) {
    details.category = 'Category is required.'
  } else if (!CATEGORIES.includes(body.category)) {
    details.category = `Category must be one of: ${CATEGORIES.join(', ')}`
  }

  if (body.imageUrl !== undefined && body.imageUrl !== null && typeof body.imageUrl !== 'string') {
    details.imageUrl = 'imageUrl must be a string.'
  }
  if (body.author !== undefined && body.author !== null && typeof body.author !== 'string') {
    details.author = 'author must be a string.'
  }

  if (Object.keys(details).length) {
    return res.status(400).json({ error: 'Invalid board payload.', details })
  }
  next()
}

// GET /api/boards?filter&search — `filter` must be a known view filter when present.
export function validateListBoardsQuery(req, res, next) {
  const { filter } = req.query
  if (filter !== undefined && !FILTERS.includes(filter)) {
    return res.status(400).json({
      error: 'Invalid filter.',
      details: { filter: `Must be one of: ${FILTERS.join(', ')}` },
    })
  }
  next()
}

// POST /api/boards/:boardId/cards — message + gifUrl required.
export function validateCreateCard(req, res, next) {
  const body = req.body || {}
  const details = {}

  if (!isNonEmptyString(body.message)) details.message = 'Message is required.'
  if (!isNonEmptyString(body.gifUrl)) details.gifUrl = 'A GIF is required.'
  if (body.author !== undefined && body.author !== null && typeof body.author !== 'string') {
    details.author = 'author must be a string.'
  }

  if (Object.keys(details).length) {
    return res.status(400).json({ error: 'Invalid card payload.', details })
  }
  next()
}

// POST /api/boards/:boardId/cards/:cardId/replies — message required; gifUrl optional.
export function validateCreateReply(req, res, next) {
  const body = req.body || {}
  const details = {}

  if (!isNonEmptyString(body.message)) details.message = 'Message is required.'
  if (body.gifUrl !== undefined && body.gifUrl !== null && typeof body.gifUrl !== 'string') {
    details.gifUrl = 'gifUrl must be a string.'
  }
  if (body.author !== undefined && body.author !== null && typeof body.author !== 'string') {
    details.author = 'author must be a string.'
  }

  if (Object.keys(details).length) {
    return res.status(400).json({ error: 'Invalid reply payload.', details })
  }
  next()
}

// PATCH /api/boards/:boardId/cards/:cardId/pin — `pinned` must be a boolean.
export function validatePin(req, res, next) {
  const { pinned } = req.body || {}
  if (typeof pinned !== 'boolean') {
    return res.status(400).json({
      error: 'Invalid pin payload.',
      details: { pinned: 'pinned must be a boolean.' },
    })
  }
  next()
}

export { CATEGORIES, FILTERS }
