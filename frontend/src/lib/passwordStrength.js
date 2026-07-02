// ============================================================================
// Password strength evaluation.
//
// Thin wrapper over @zxcvbn-ts (the maintained TypeScript rewrite of Dropbox's
// zxcvbn). Unlike character-counting rules ("8+ chars, 1 symbol"), zxcvbn
// estimates how many guesses a real attacker would need by matching the input
// against dictionaries, keyboard patterns, dates, repeats and l33t-speak
// substitutions — so it rates "P@ssw0rd1" weak and "correcthorsebattery"
// strong, which is the point.
//
// Components import evaluate() and STRENGTH_LEVELS only; they never touch the
// zxcvbn options object. Mirrors the "one clean contract" style of auth.js/api.js.
// ============================================================================

import { ZxcvbnFactory } from '@zxcvbn-ts/core'
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common'
import * as zxcvbnEnPackage from '@zxcvbn-ts/language-en'

// @zxcvbn-ts v4 is factory-based: you build ONE instance configured with the
// word lists + translations, then call .check() on it. `dictionary` supplies
// the lists (common passwords, names, English words); `graphs` powers keyboard-
// pattern detection; `translations` supplies the human-readable warning strings.
// Built lazily so the (heavy) dictionaries are only constructed on first use.
let zxcvbnInstance = null
function getInstance() {
  if (zxcvbnInstance) return zxcvbnInstance
  zxcvbnInstance = new ZxcvbnFactory({
    dictionary: {
      ...zxcvbnCommonPackage.dictionary,
      ...zxcvbnEnPackage.dictionary,
    },
    graphs: zxcvbnCommonPackage.adjacencyGraphs,
    translations: zxcvbnEnPackage.translations,
  })
  return zxcvbnInstance
}

// zxcvbn returns a score 0..4. We give each a label + a token for coloring.
// Index into this array with result.score.
export const STRENGTH_LEVELS = [
  { label: 'Very weak', tone: 'danger' },
  { label: 'Weak', tone: 'danger' },
  { label: 'Fair', tone: 'warn' },
  { label: 'Good', tone: 'ok' },
  { label: 'Strong', tone: 'strong' },
]

// Evaluate a password. Returns a UI-ready shape:
//   { score, label, tone, warning, suggestions, crackTime }
// `userInputs` (e.g. the username) let zxcvbn penalize passwords built from
// data the attacker would already know about this specific user.
export function evaluate(password, userInputs = []) {
  if (!password) {
    return { score: 0, label: '', tone: 'empty', warning: '', suggestions: [] }
  }

  const result = getInstance().check(password, userInputs)
  const level = STRENGTH_LEVELS[result.score] ?? STRENGTH_LEVELS[0]

  return {
    score: result.score, // 0..4
    label: level.label,
    tone: level.tone,
    // zxcvbn's own coaching. `warning` is the single biggest problem (may be
    // empty); `suggestions` are actionable tips.
    warning: result.feedback.warning || '',
    suggestions: result.feedback.suggestions || [],
  }
}
