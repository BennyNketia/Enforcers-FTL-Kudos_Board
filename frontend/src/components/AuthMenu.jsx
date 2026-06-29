import { useEffect, useRef, useState } from 'react'
import { UserIcon, LogOutIcon } from './icons.jsx'
import './AuthMenu.css'

// Header auth control. Signed out → a "Sign in" button that opens AuthModal.
// Signed in → an avatar button that opens a small dropdown with the username
// and a Log out action. Closes on outside click and Esc.
export default function AuthMenu({ user, onRequestAuth, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) {
    return (
      <button
        className="ui-btn ui-btn--outline ui-btn--sm auth-menu__signin"
        onClick={() => onRequestAuth('login')}
      >
        <UserIcon width="18" height="18" />
        <span className="auth-menu__signin-label">Sign in</span>
      </button>
    )
  }

  const initial = user.username?.[0]?.toUpperCase() || '?'

  function handleLogout() {
    setOpen(false)
    onLogout?.()
  }

  return (
    <div className="auth-menu" ref={ref}>
      <button
        className="auth-menu__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        title={user.username}
      >
        <span className="avatar" aria-hidden>{initial}</span>
      </button>

      {open && (
        <div className="auth-menu__dropdown" role="menu">
          <div className="auth-menu__identity">
            <span className="avatar" aria-hidden>{initial}</span>
            <div className="auth-menu__identity-text">
              <span className="auth-menu__name">{user.username}</span>
              <span className="auth-menu__hint">Signed in</span>
            </div>
          </div>
          <div className="auth-menu__divider" />
          <button className="auth-menu__item" role="menuitem" onClick={handleLogout}>
            <LogOutIcon width="18" height="18" />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
