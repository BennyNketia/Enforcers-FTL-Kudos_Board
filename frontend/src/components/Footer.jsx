import './Footer.css'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <span className="footer__brand">
          <img className="footer__logo" src="/kudos-icon.png" alt="" aria-hidden="true" width="28" height="28" />
          <span className="t-body-sm">Made with 💜 to celebrate your team.</span>
        </span>
        <span className="t-body-sm footer__copy">© {year} Kudos Board</span>
      </div>
    </footer>
  )
}
