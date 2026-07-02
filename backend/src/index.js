// ============================================================================
// Express app entry point.
//
// Scope today: the AI proxy (/api/ai) that keeps the OpenRouter key server-side.
// The boards/cards CRUD and GIPHY proxy from planning.md §2 will mount here too
// when the rest of the backend is built; the frontend already speaks to /api.
// ============================================================================

import 'dotenv/config'
import express from 'express'
import cors from 'cors'

import aiRouter from './routes/ai.js'
import boardsRouter from './routes/boards.js'
import giphyRouter from './routes/giphy.js'
import authRouter from './routes/auth.js'
import { isConfigured, OpenRouterNotConfiguredError } from './lib/openrouter.js'
import { GiphyNotConfiguredError } from './lib/giphy.js'
import { AuthConfigError } from './lib/auth.js'

const app = express()
const PORT = process.env.PORT || 3000

// --- Middleware -------------------------------------------------------------
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : true // dev default: reflect request origin
app.use(cors({ origin: corsOrigin }))
app.use(express.json({ limit: '64kb' }))

// --- Health check -----------------------------------------------------------
// Handy for confirming the server is up and whether AI is wired in.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ai: isConfigured() })
})

// --- Routes -----------------------------------------------------------------
app.use('/api/ai', aiRouter)
app.use('/api/boards', boardsRouter)
app.use('/api/giphy', giphyRouter)
app.use('/api/auth', authRouter)

// --- 404 for unknown /api paths ---------------------------------------------
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// --- Central error handler --------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (
    err instanceof OpenRouterNotConfiguredError ||
    err instanceof GiphyNotConfiguredError ||
    err instanceof AuthConfigError
  ) {
    return res.status(500).json({ error: err.message })
  }
  // All free AI models were rate-limited upstream — not our bug, and a retry
  // usually succeeds. Tell the user that plainly instead of a generic 500.
  if (err.status === 429) {
    return res.status(503).json({
      error: 'The free AI models are busy right now. Please wait a moment and try again.',
    })
  }
  console.error('[error]', err)
  res.status(500).json({ error: 'Something went wrong on the server.' })
})

app.listen(PORT, () => {
  console.log(`Kudos backend listening on http://localhost:${PORT}`)
  console.log(`  AI (OpenRouter): ${isConfigured() ? 'configured ✓' : 'NOT configured — add OPENROUTER_API_KEY to backend/.env'}`)
})
