import './Banner.css'

// Home hero. Gradient from celebration → background → inspiration soft tones.
export default function Banner({
  headline = 'Spread a little kudos',
  subtitle = 'Create boards, drop appreciation cards, and celebrate the people you work with.',
}) {
  return (
    <section className="banner">
      <span className="banner__confetti banner__confetti--1" aria-hidden>🎉</span>
      <span className="banner__confetti banner__confetti--2" aria-hidden>✨</span>
      <span className="banner__confetti banner__confetti--3" aria-hidden>💜</span>
      <div className="container banner__content">
        <h1 className="banner__headline t-display-xl">{headline}</h1>
        <p className="banner__subtitle t-body-lg">{subtitle}</p>
      </div>
    </section>
  )
}
