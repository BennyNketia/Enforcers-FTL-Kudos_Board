import { LogoIcon } from './icons.jsx'
import './Footer.css'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <span className="footer__brand">
          <span className="footer__logo" aria-hidden><LogoIcon width="18" height="18" /></span>
          <span className="t-body-sm">Made with 💜 to celebrate your team.</span>
        </span>
        <span className="t-body-sm footer__copy">© {year} Kudos Board</span>
      </div>
    </footer>
  )
}
