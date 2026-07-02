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

// Free models sometimes prepend narration ("Here is a heartfelt message:",
// "Sure!", a "We need to produce…" restatement of the task) before the actual
// message, or wrap the whole thing in quotes. Strip those so the composer only
// hands back the message itself.
function cleanMessage(raw) {
  let text = String(raw).trim()

  // Reasoning models sometimes wrap their thinking in <think>…</think> before
  // the answer. Drop any such block (and a stray closing tag) entirely.
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/^[\s\S]*<\/think>/i, '').trim()

  // A lead-in phrase followed by a colon on the same line, e.g.
  // "Here's a heartfelt note: <message>" or "We need to produce a message: …".
  // Stops at the FIRST colon (excludes ':' from the run) so we never chew into
  // the message itself, and never treats a hyphen/em-dash as a terminator.
  const leadInColon = /^(?:sure|okay|ok|of course|certainly|absolutely|here(?:'s| is| you go)?|below is|i(?:'ve| have) (?:written|drafted)|we need to|this is)\b[^\n:]*:\s*/i
  text = text.replace(leadInColon, '').trim()

  // A short interjection lead-in ending in '!' , ',' or '.', e.g. "Sure! <msg>".
  const interjection = /^(?:sure|okay|ok|of course|certainly|absolutely|no problem)[!,.]\s+/i
  text = text.replace(interjection, '').trim()

  // Strip a wrapping pair of quotes if the model quoted the whole message.
  text = text.replace(/^["'“”]+/, '').replace(/["'“”]+$/, '').trim()

  return text
}

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

    const recipientName =
      typeof recipient === 'string' && recipient.trim() ? recipient.trim() : ''

    const message = await chat(
      [
        {
          role: 'system',
          content:
            'You are a kudos-writing assistant. Given a recipient and a few rough notes, ' +
            'you WRITE the finished kudos message — a short note of praise, thanks, and ' +
            'appreciation addressed directly to that person.\n\n' +
            'Rules:\n' +
            '- Output ONLY the finished message, ready to post as-is.\n' +
            '- 1–2 sentences, under 280 characters.\n' +
            `- ${toneDesc} tone.\n` +
            '- Write in second person ("you") when it reads naturally.\n' +
            '- No hashtags, no emojis, no surrounding quotation marks, no sign-off or signature.\n' +
            '- Do NOT restate these instructions, do NOT explain your reasoning, and do NOT ' +
            'describe the task (never write things like "Here is" or "We need to produce"). ' +
            'Just write the message itself.',
        },
        // One-shot example so the model locks onto input→output, not narration.
        {
          role: 'user',
          content:
            'Recipient: Sarah\nNotes: covered my weekend shift, total lifesaver, saved the launch',
        },
        {
          role: 'assistant',
          content:
            'Sarah, you completely saved the launch by covering my weekend shift — I honestly ' +
            "don't know what we'd have done without you. Thank you for being such a lifesaver.",
        },
        {
          role: 'user',
          content:
            `Recipient: ${recipientName || '(not named)'}\nNotes: ${keywords.trim()}`,
        },
      ],
      { temperature: 0.8, maxTokens: 160 },
    )

    res.json({ message: cleanMessage(message) })
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
