// ============================================================================
// One-off seed script.
//
// Walks data.js (repo root) and POSTs every seed board + card into the running
// backend via the public API — same routes the frontend uses (planning.md §2).
//
//   1. POST /api/boards            → for each seedBoard, capture the new UUID
//   2. POST /api/boards/:id/cards  → for each seedCard, mapping its placeholder
//                                    boardId ("seed-board-1") to the real UUID
//   3. PATCH .../upvote (xN)       → bump each card to its seed upvotes count
//   4. PATCH .../pin               → flip the one pinned seed card
//
// Run:   node scripts/seed.js          (with backend already running)
//
// Idempotency: NOT idempotent. Running twice creates duplicates. Clear the DB
// first if needed:  npx prisma migrate reset  --or--  DELETE manually.
// ============================================================================

import { seedBoards, seedCards } from '../../data.js'

const BASE = process.env.API_BASE || `http://localhost:${process.env.PORT || 3000}/api`

// Minimal fetch wrapper — surfaces { error, details } payloads from the backend
// so the failing endpoint is obvious instead of a generic "HTTP 400".
async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = data ? JSON.stringify(data) : res.statusText
    throw new Error(`${method} ${path} → ${res.status}: ${detail}`)
  }
  return data
}

async function main() {
  console.log(`Seeding via ${BASE}`)

  // 1. Boards. Map placeholder seed id -> real UUID so cards can attach.
  const idMap = {}
  for (const b of seedBoards()) {
    const created = await api('POST', '/boards', {
      title: b.title,
      category: b.category,
      imageUrl: b.imageUrl,
      author: b.author,
    })
    idMap[b.id] = created.id
    console.log(`  board  ${b.title.padEnd(28)} → ${created.id}`)
  }

  // 2. Cards. Skip if the placeholder boardId doesn't map (orphan in data.js).
  for (const c of seedCards()) {
    const realBoardId = idMap[c.boardId]
    if (!realBoardId) {
      console.warn(`  skip card "${c.message.slice(0, 30)}…" — unknown boardId ${c.boardId}`)
      continue
    }

    const card = await api('POST', `/boards/${realBoardId}/cards`, {
      message: c.message,
      gifUrl: c.gifUrl,
      author: c.author || undefined,
    })
    console.log(`  card   ${c.message.slice(0, 38).padEnd(40)} → ${card.id}`)

    // 3. Upvote N times. The endpoint is +1 only (no bulk set), so loop.
    for (let i = 0; i < (c.upvotes || 0); i++) {
      await api('PATCH', `/boards/${realBoardId}/cards/${card.id}/upvote`)
    }

    // 4. Pin if the seed says so.
    if (c.pinned) {
      await api('PATCH', `/boards/${realBoardId}/cards/${card.id}/pin`, { pinned: true })
    }
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
