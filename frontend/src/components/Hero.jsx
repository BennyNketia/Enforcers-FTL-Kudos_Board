import { LayersIcon, HeartIcon, SparkleIcon } from './icons.jsx'
import './Hero.css'

// Home hero: gradient backdrop, headline + subtitle, and three live stat cards
// (Total Boards, Total Cards, Recent Boards). Stats come from HomePage.
export default function Hero({ stats, loading, onPrimary }) {
  const items = [
    { key: 'boards', label: 'Total Boards', value: stats?.boards, Icon: LayersIcon, tone: 'primary' },
    { key: 'cards', label: 'Total Cards', value: stats?.cards, Icon: HeartIcon, tone: 'celebration' },
    { key: 'recent', label: 'Recent Boards', value: stats?.recent, Icon: SparkleIcon, tone: 'inspiration' },
  ]

  return (
    <section className="hero">
      <span className="hero__blob hero__blob--1" aria-hidden />
      <span className="hero__blob hero__blob--2" aria-hidden />
      <div className="container hero__inner">
        <div className="hero__copy">
          <span className="hero__eyebrow t-tag">Team appreciation · organized</span>
          <h1 className="hero__headline t-display-xl">
            Spread a little <span className="hero__accent">kudos</span>
          </h1>
          <p className="hero__subtitle t-body-lg">
            Create themed boards, drop appreciation cards with the perfect GIF, and celebrate
            the people you work with.
          </p>
          <div className="hero__cta">
            <button className="ui-btn ui-btn--primary" onClick={onPrimary}>
              Create a board
            </button>
            <a className="ui-btn ui-btn--outline" href="#all-boards">
              Browse boards
            </a>
          </div>
        </div>

        <div className="hero__stats" role="list">
          {items.map(({ key, label, value, Icon, tone }) => (
            <div className={`stat-card stat-card--${tone}`} role="listitem" key={key}>
              <span className="stat-card__icon">
                <Icon width="20" height="20" />
              </span>
              <span className="stat-card__value t-h1">
                {loading || value == null ? '—' : value}
              </span>
              <span className="stat-card__label t-body-sm">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
