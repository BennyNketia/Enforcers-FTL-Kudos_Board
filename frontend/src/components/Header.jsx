import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle.jsx'
import { LogoIcon } from './icons.jsx'
import './Header.css'

// Sticky top bar. Adds a blurred/elevated look once the page is scrolled.
export default function Header({ theme, onToggleTheme }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`header${scrolled ? ' header--scrolled' : ''}`}>
      <div className="container header__inner">
        <Link to="/" className="header__brand">
          <span className="header__logo">
            <LogoIcon />
          </span>
          <span className="header__title t-h3">Kudos Board</span>
        </Link>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  )
}
