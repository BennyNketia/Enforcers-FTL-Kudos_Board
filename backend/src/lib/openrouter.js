// ============================================================================
// OpenRouter client — the single place that talks to the LLM.
//
// Every AI feature (the "Help me write" composer today, the AI GIF-term
// suggester next) goes through this one `chat()` helper; callers only change
// the prompt. The API key stays server-side (read from process.env), so it is
// never shipped to the browser — see planning.md §2.3 / §7.
// ============================================================================

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const REQUEST_TIMEOUT_MS = 30_000

// Free models are frequently rate-limited upstream (429). Rather than depend on
// one, we try several in order and fall back to the next on a transient failure.
// OPENROUTER_MODEL (if set) is tried first; the rest are free fallbacks.
// Verified against the live OpenRouter free catalog. Diverse providers so a
// single upstream outage/throttle doesn't take them all down at once. If a model
// id 404s (delisted), the chain skips past it — refresh this list occasionally
// via GET https://openrouter.ai/api/v1/models.
// IMPORTANT: instruct/chat models ONLY — no "reasoning" models. Reasoning models
// (e.g. gpt-oss, nemotron) stream their chain-of-thought into the message content
// and burn the whole token budget before writing the answer, which leaks "First,
// I need to recall the rules…" into the kudos or truncates it mid-sentence.
const FALLBACK_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'google/gemma-4-31b-it:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'meta-llama/llama-3.2-3b-instruct:free',
]

function modelChain() {
  const preferred = process.env.OPENROUTER_MODEL?.trim()
  // Preferred first, then the fallbacks, de-duplicated.
  return [...new Set([preferred, ...FALLBACK_MODELS].filter(Boolean))]
}

// Retry on another model for: 429 (rate limit), 404 (model delisted/unavailable),
// and 5xx (provider hiccup). A 400/401/403 is our fault (bad request/key) and
// would just repeat, so those abort the chain immediately.
function isRetriable(status) {
  return status === 429 || status === 404 || status >= 500
}

// Thrown when AI isn't configured yet (no key). The route layer turns this into
// a clean 500 with a helpful message instead of a stack trace.
export class OpenRouterNotConfiguredError extends Error {
  constructor() {
    super('AI is not configured. Add OPENROUTER_API_KEY to backend/.env and restart the server.')
    this.name = 'OpenRouterNotConfiguredError'
  }
}

export function isConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY)
}

// One request to a specific model. Returns the trimmed message text, or throws.
// A thrown error carries `.status` (when known) so the caller can decide whether
// to fall back to the next model.
async function requestModel(model, messages, { temperature, maxTokens }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        // Optional attribution headers OpenRouter uses for ranking.
        'HTTP-Referer': process.env.OPENROUTER_APP_URL || 'http://localhost:5173',
        'X-Title': process.env.OPENROUTER_APP_TITLE || 'Kudos Board',
      },
      // reasoning.exclude keeps any model's chain-of-thought out of the response
      // so it can't leak into (or crowd out) the actual message. Ignored by
      // models that don't reason.
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        reasoning: { exclude: true },
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      const err = new Error(`OpenRouter responded ${res.status}: ${detail.slice(0, 300)}`)
      err.status = res.status
      throw err
    }

    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) throw new Error('OpenRouter returned an empty response.')
    return content.trim()
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('The AI request timed out. Try again.')
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Send a chat completion to OpenRouter and return the assistant's text.
 * Tries each model in the chain, falling back to the next on a rate-limit (429)
 * or provider error (5xx). A specific `model` opt skips the chain.
 *
 * @param {Array<{role: 'system'|'user'|'assistant', content: string}>} messages
 * @param {{ temperature?: number, maxTokens?: number, model?: string }} [opts]
 * @returns {Promise<string>} the assistant message content, trimmed
 */
export async function chat(messages, { temperature = 0.8, maxTokens = 200, model } = {}) {
  if (!isConfigured()) throw new OpenRouterNotConfiguredError()

  const models = model ? [model] : modelChain()
  let lastErr

  for (const m of models) {
    try {
      return await requestModel(m, messages, { temperature, maxTokens })
    } catch (err) {
      lastErr = err
      // Only fall back on transient failures; a real error (e.g. bad request,
      // bad key) would just repeat, so surface it immediately.
      if (err.status !== undefined && !isRetriable(err.status)) throw err
      console.warn(`[openrouter] ${m} failed (${err.status ?? err.message}); trying next model…`)
    }
  }

  throw lastErr || new Error('All AI models failed. Try again shortly.')
}
