import './Footer.css'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <span className="t-body-sm">Made with 💜 to celebrate your team.</span>
        <span className="t-body-sm">© {year} Kudos Board</span>
      </div>
    </footer>
  )
}
