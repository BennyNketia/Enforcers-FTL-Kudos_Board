import { Link } from 'react-router-dom'
import './Logo.css'

// Brand mark: the cherub icon (image, served from public/) + the "Kudos Board"
// wordmark as real text. Text (rather than baked-into-the-image type) means it
// recolours per theme automatically and stays crisp at any size — so no
// light/dark artwork swap is needed; only the transparent icon is shared.
// Pass `to={null}` (e.g. in the footer) for a non-interactive mark.
export default function Logo({ to = '/', className = '', ...rest }) {
  const inner = (
    <>
      <img
        src="/kudos-icon.png"
        alt=""
        aria-hidden="true"
        className="logo__icon"
        width="120"
        height="120"
        decoding="async"
      />
      <span className="logo__text">
        Kudos <span className="logo__text-accent">Board</span>
      </span>
    </>
  )

  if (to === null) {
    return (
      <span className={`brand ${className}`.trim()} aria-label="Kudos Board" {...rest}>
        {inner}
      </span>
    )
  }

  return (
    <Link to={to} className={`brand ${className}`.trim()} aria-label="Kudos Board home" {...rest}>
      {inner}
    </Link>
  )
}
