import { useEffect, useMemo } from 'react'
import { evaluate } from '../lib/passwordStrength.js'
import './PasswordStrengthMeter.css'

// Live password-strength indicator shown under the password field during signup.
// Renders a 4-segment bar (filled up to the score) plus zxcvbn's own label,
// warning and suggestions. Pass `userInputs` (e.g. the username) so a password
// derived from known user data gets penalized. `onResult` lifts the computed
// score up to the parent so it can gate submission — this keeps zxcvbn behind
// the lazy boundary (only this component ever imports it).
export default function PasswordStrengthMeter({ password, userInputs = [], onResult }) {
  // Recompute only when the inputs change. zxcvbn is fast, but a signup form
  // re-renders on every keystroke in *any* field — this skips redundant runs.
  const result = useMemo(
    () => evaluate(password, userInputs),
    [password, userInputs],
  )

  // Report the score upward. In an effect (not during render) so we never call
  // the parent's setState mid-render.
  useEffect(() => {
    onResult?.(result)
  }, [result, onResult])

  // Nothing to show until the user starts typing.
  if (!password) return null

  // Score 0 and 1 both mean "weak"; fill at least one segment so the bar is
  // never empty while a (bad) password is present.
  const filled = Math.max(1, result.score)

  return (
    <div className="pw-meter">
      <div className="pw-meter__bar" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`pw-meter__seg${i < filled ? ` pw-meter__seg--${result.tone}` : ''}`}
          />
        ))}
      </div>

      {/* aria-live so screen readers announce strength changes, politely. */}
      <p className="pw-meter__status" role="status" aria-live="polite">
        <span className={`pw-meter__label pw-meter__label--${result.tone}`}>
          {result.label}
        </span>
      </p>

      {(result.warning || result.suggestions.length > 0) && (
        <div className="pw-meter__feedback">
          {result.warning && (
            <p className="pw-meter__warning">{result.warning}</p>
          )}
          {result.suggestions.map((tip) => (
            <p key={tip} className="pw-meter__tip">
              {tip}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
