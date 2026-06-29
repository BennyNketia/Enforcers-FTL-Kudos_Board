import { PlusIcon, CompassIcon, ClockIcon } from './icons.jsx'
import './QuickActions.css'

// Three entry-point cards under the hero. Each calls back into HomePage:
// create a board, jump to the Inspiration filter, or show recent boards.
export default function QuickActions({ onCreate, onBrowseInspiration, onViewRecent }) {
  const actions = [
    {
      key: 'create',
      tone: 'primary',
      Icon: PlusIcon,
      title: 'Create a board',
      desc: 'Start a fresh space to collect kudos for a team or moment.',
      onClick: onCreate,
    },
    {
      key: 'inspiration',
      tone: 'inspiration',
      Icon: CompassIcon,
      title: 'Browse inspiration',
      desc: 'See motivational boards to spark your next shout-out.',
      onClick: onBrowseInspiration,
    },
    {
      key: 'recent',
      tone: 'celebration',
      Icon: ClockIcon,
      title: 'View recent boards',
      desc: 'Jump back into the boards created most recently.',
      onClick: onViewRecent,
    },
  ]

  return (
    <section className="quick-actions" aria-label="Quick actions">
      {actions.map(({ key, tone, Icon, title, desc, onClick }) => (
        <button className={`qa-card qa-card--${tone}`} key={key} onClick={onClick}>
          <span className="qa-card__icon">
            <Icon width="22" height="22" />
          </span>
          <span className="qa-card__text">
            <span className="qa-card__title t-h4">{title}</span>
            <span className="qa-card__desc t-body-sm">{desc}</span>
          </span>
          <span className="qa-card__arrow" aria-hidden>→</span>
        </button>
      ))}
    </section>
  )
}
