import { useState } from 'react'
import { HeartIcon } from './icons.jsx'
import './UpvoteButton.css'

// Heart + live count. Pops on click. Each user may like a card once: clicking
// toggles their like on/off, so `liked` (not the raw count) drives the filled
// heart and the pressed styling.
export default function UpvoteButton({ count, liked = false, onUpvote }) {
  const [animating, setAnimating] = useState(false)

  function handleClick() {
    // Only pop on the like → not on the un-like.
    if (!liked) {
      setAnimating(true)
      window.setTimeout(() => setAnimating(false), 200)
    }
    onUpvote?.()
  }

  return (
    <button
      className={`upvote${liked ? ' upvote--liked' : ''}`}
      onClick={handleClick}
      aria-pressed={liked}
      aria-label={liked ? `Remove upvote (${count})` : `Upvote (${count})`}
    >
      <span className={`upvote__icon${animating ? ' upvote__icon--pop' : ''}`}>
        <HeartIcon filled={liked} width="18" height="18" />
      </span>
      <span className="upvote__count">{count}</span>
    </button>
  )
}
