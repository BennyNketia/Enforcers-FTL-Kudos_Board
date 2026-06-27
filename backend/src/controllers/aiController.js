// ============================================================================
// AI controllers. Each handler builds a prompt and delegates to the shared
// OpenRouter `chat()` helper (src/lib/openrouter.js).
//
//   compose      → "Help me write" kudos composer        (implemented)
//   suggestGifs  → AI GIF-term suggester (teammate)       (stub — see below)
// ============================================================================

import { chat, OpenRouterNotConfiguredError } from '../lib/openrouter.js'

// Tones the composer offers. Kept here so the prompt and the validation share
// one list; the frontend mirrors these keys in lib/ai.js.
const TONES = {
  heartfelt: 'warm, sincere, and emotionally genuine',
  funny: 'playful and lightly humorous, with a touch of wit (still kind)',
  professional: 'polished, respectful, and workplace-appropriate',
  poetic: 'lyrical and evocative, with a gentle rhythm',
  hype: 'high-energy and enthusiastic, celebratory and bold',
}

const MAX_KEYWORDS_LEN = 500

/**
 * POST /api/ai/compose
 * Body: { keywords: string, tone?: string, recipient?: string }
 * Returns: { message: string }
 *
 * Drafts a short kudos message from a few keywords + a chosen tone.
 */
export async function compose(req, res, next) {
  try {
    const { keywords, tone = 'heartfelt', recipient } = req.body || {}

    if (typeof keywords !== 'string' || !keywords.trim()) {
      return res.status(400).json({ error: 'Please add a few keywords describing the kudos.' })
    }
    if (keywords.length > MAX_KEYWORDS_LEN) {
      return res.status(400).json({ error: `Keywords are too long (max ${MAX_KEYWORDS_LEN} characters).` })
    }

    const toneKey = String(tone).toLowerCase()
    const toneDesc = TONES[toneKey]
    if (!toneDesc) {
      return res.status(400).json({
        error: 'Invalid tone.',
        details: { tone: `Must be one of: ${Object.keys(TONES).join(', ')}` },
      })
    }

    const recipientLine =
      typeof recipient === 'string' && recipient.trim()
        ? `The kudos is addressed to: ${recipient.trim()}.`
        : 'The recipient may not be named — keep it natural either way.'

    const message = await chat(
      [
        {
          role: 'system',
          content:
            'You write short, original kudos messages — notes of praise, thanks, and ' +
            'appreciation for a coworker or friend. Rules: 1–2 sentences, under 280 characters. ' +
            `Use a ${toneDesc} tone. Write in second person ("you") when natural. ` +
            'Do NOT use hashtags, emojis, surrounding quotation marks, or a sign-off/signature. ' +
            'Output ONLY the message text, nothing else.',
        },
        {
          role: 'user',
          content: `${recipientLine}\nWhat they did / notes: ${keywords.trim()}`,
        },
      ],
      { temperature: 0.9, maxTokens: 160 },
    )

    // Strip wrapping quotes the model sometimes adds despite instructions.
    const cleaned = message.replace(/^["'“”]+|["'“”]+$/g, '').trim()
    res.json({ message: cleaned })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/ai/suggest-gifs   — TEAMMATE'S FEATURE (not implemented yet).
 *
 * Planned: take the drafted `message`, ask the model for 2–3 short GIPHY search
 * terms that match its vibe, return { terms: string[] }. The frontend then runs
 * those through the existing GIPHY search. See planning.md §7.2.
 *
 * To implement: build the prompt, call `chat(..., { maxTokens: 60 })`, parse the
 * terms (a JSON array or comma-split), and `res.json({ terms })`.
 */
export async function suggestGifs(req, res) {
  res.status(501).json({ error: 'AI GIF suggestions are not implemented yet.' })
}

// Re-exported so the route layer can special-case the "no key configured" case.
export { OpenRouterNotConfiguredError }
