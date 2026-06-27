import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ThemeToggle from './ThemeToggle.jsx'
import { LogoIcon, PlusIcon } from './icons.jsx'
import './Header.css'

// Sticky top navigation: brand (left), Create Board + theme toggle (right).
// "Create Board" routes home with ?new=1 so HomePage opens the create modal —
// this keeps the action reachable from the board detail page too.
export default function Header({ theme, onToggleTheme }) {
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`header${scrolled ? ' header--scrolled' : ''}`}>
      <div className="container header__inner">
        <Link to="/" className="header__brand" aria-label="Kudos Board home">
          <span className="header__logo">
            <LogoIcon />
          </span>
          <span className="header__title t-h3">Kudos Board</span>
        </Link>

        <div className="header__actions">
          <button
            className="ui-btn ui-btn--primary ui-btn--sm header__create"
            onClick={() => navigate('/?new=1')}
          >
            <PlusIcon width="18" height="18" />
            <span className="header__create-label">Create Board</span>
          </button>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </header>
  )
}
