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

const MAX_MESSAGE_LEN = 500
const MAX_TERMS = 3

// LLMs don't reliably emit clean JSON even when asked. Try JSON first, then fall
// back to comma/newline splitting, so a slightly-off response still yields terms.
function parseTerms(raw) {
  let terms = []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) terms = parsed
  } catch {
    // Not JSON — strip any leading "1." / "-" bullets and split on commas/newlines.
    terms = raw
      .replace(/^[\s\-*\d.)]+/gm, '')
      .split(/[,\n]/)
  }
  // Normalize: strings only, trimmed, no wrapping quotes, deduped, capped.
  return [...new Set(
    terms
      .filter((t) => typeof t === 'string')
      .map((t) => t.replace(/^["'“”]+|["'“”]+$/g, '').trim().toLowerCase())
      .filter(Boolean),
  )].slice(0, MAX_TERMS)
}

/**
 * POST /api/ai/suggest-gifs
 * Body: { message: string }
 * Returns: { terms: string[] }   (2–3 short GIPHY search terms)
 *
 * Reads the drafted kudos message and suggests search terms whose vibe matches.
 * The frontend feeds these into the existing GIPHY search. See planning.md §7.2.
 */
export async function suggestGifs(req, res, next) {
  try {
    const { message } = req.body || {}

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'A message is required to suggest GIFs.' })
    }
    if (message.length > MAX_MESSAGE_LEN) {
      return res.status(400).json({ error: `Message is too long (max ${MAX_MESSAGE_LEN} characters).` })
    }

    const raw = await chat(
      [
        {
          role: 'system',
          content:
            'You suggest short GIPHY search terms for a kudos/celebration message. ' +
            `Return ONLY a JSON array of ${MAX_TERMS} short search terms (1–2 words each), ` +
            'lowercase, no explanation. Example: ["high five","celebration","teamwork"]. ' +
            'The terms should capture the mood and theme of the message, not quote it.',
        },
        { role: 'user', content: message.trim() },
      ],
      { temperature: 0.7, maxTokens: 60 },
    )

    const terms = parseTerms(raw)
    if (terms.length === 0) {
      return res.status(502).json({ error: 'Couldn’t come up with GIF ideas. Try again.' })
    }
    res.json({ terms })
  } catch (err) {
    next(err)
  }
}

// Re-exported so the route layer can special-case the "no key configured" case.
export { OpenRouterNotConfiguredError }
