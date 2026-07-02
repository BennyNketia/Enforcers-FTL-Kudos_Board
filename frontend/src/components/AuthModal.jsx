import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { EyeIcon, EyeOffIcon } from './icons.jsx'
import { auth } from '../lib/auth.js'
import './AuthModal.css'

// Lazy so zxcvbn + its dictionaries download only when the signup tab needs
// them — sign-in users never pay for that chunk.
const PasswordStrengthMeter = lazy(() => import('./PasswordStrengthMeter.jsx'))

// Minimum zxcvbn score (0..4) required to create an account. 3 = "Good":
// must be *above* the 2nd level ("Fair"), so trivially guessable and merely
// so-so passwords are both rejected.
const MIN_PASSWORD_SCORE = 3

const EMPTY = { username: '', password: '' }

// Combined Sign in / Create account dialog. A small tab switch toggles the mode
// so users don't need two separate entry points. On success it hands the user
// up to App via onAuthenticated() and closes.
export default function AuthModal({ open, mode = 'login', onClose, onAuthenticated }) {
  const [tab, setTab] = useState(mode)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  // Latest zxcvbn score, lifted up from the meter (null until it first reports).
  const [pwScore, setPwScore] = useState(null)
  // Reveal the password as plain text while this is on.
  const [showPassword, setShowPassword] = useState(false)

  // Reset to the requested mode whenever the modal is (re)opened.
  useEffect(() => {
    if (open) {
      setTab(mode)
      setForm(EMPTY)
      setErrors({})
      setSubmitting(false)
      setPwScore(null)
      setShowPassword(false)
    }
  }, [open, mode])

  // Stable identity so the meter's onResult effect doesn't re-fire every render.
  const handlePwResult = useCallback((result) => setPwScore(result.score), [])

  const isSignup = tab === 'signup'

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function switchTab(next) {
    setTab(next)
    setErrors({})
  }

  function validate() {
    const next = {}
    if (!form.username.trim()) next.username = 'Username is required.'
    if (!form.password) next.password = 'Password is required.'
    // Enforce strength on signup only — never block an existing user from
    // signing in with a password that predates this rule.
    else if (isSignup && pwScore !== null && pwScore < MIN_PASSWORD_SCORE) {
      next.password = 'Please choose a stronger password.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      const creds = { username: form.username.trim(), password: form.password }
      const user = isSignup ? await auth.signup(creds) : await auth.login(creds)
      onAuthenticated?.(user)
      onClose()
    } catch (err) {
      setErrors({ form: err?.message || 'Something went wrong. Try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      title={isSignup ? 'Create your account' : 'Welcome back'}
      onClose={onClose}
    >
      <div className="auth-tabs" role="tablist" aria-label="Login or sign up">
        <button
          type="button"
          role="tab"
          aria-selected={!isSignup}
          className={`auth-tab${!isSignup ? ' auth-tab--active' : ''}`}
          onClick={() => switchTab('login')}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isSignup}
          className={`auth-tab${isSignup ? ' auth-tab--active' : ''}`}
          onClick={() => switchTab('signup')}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="auth-username">
            Username<span className="req">*</span>
          </label>
          <input
            id="auth-username"
            className={`field__input${errors.username ? ' field__input--error' : ''}`}
            value={form.username}
            onChange={(e) => set('username', e.target.value)}
            placeholder="e.g. jordan"
            autoComplete="username"
            autoFocus
          />
          {errors.username && <span className="field__error">{errors.username}</span>}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="auth-password">
            Password<span className="req">*</span>
          </label>
          <div className="pw-input">
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              className={`field__input pw-input__field${errors.password ? ' field__input--error' : ''}`}
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              placeholder={isSignup ? 'Choose a password' : 'Your password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              className="pw-input__toggle"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              tabIndex={-1}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {errors.password && <span className="field__error">{errors.password}</span>}

          {/* Live strength feedback — signup only. Suspense renders nothing
              while the lazy chunk loads (it arrives in a keystroke or two). */}
          {isSignup && form.password && (
            <Suspense fallback={null}>
              <PasswordStrengthMeter
                password={form.password}
                userInputs={form.username ? [form.username] : []}
                onResult={handlePwResult}
              />
            </Suspense>
          )}
        </div>

        {errors.form && (
          <p className="field__error" style={{ marginBottom: 'var(--space-3)' }}>
            {errors.form}
          </p>
        )}

        <div className="modal-actions">
          <button type="submit" className="ui-btn ui-btn--primary" disabled={submitting}>
            {submitting && <span className="spinner" aria-hidden />}
            {submitting
              ? isSignup
                ? 'Creating…'
                : 'Signing in…'
              : isSignup
                ? 'Create account'
                : 'Sign in'}
          </button>
          <button
            type="button"
            className="ui-btn ui-btn--ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      </form>

      <p className="auth-switch">
        {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          type="button"
          className="auth-switch__link"
          onClick={() => switchTab(isSignup ? 'login' : 'signup')}
        >
          {isSignup ? 'Sign in' : 'Create one'}
        </button>
      </p>
    </Modal>
  )
}
