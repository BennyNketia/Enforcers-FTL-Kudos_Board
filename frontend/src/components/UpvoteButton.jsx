import { useState } from 'react'
import { HeartIcon } from './icons.jsx'
import './UpvoteButton.css'

// Heart + live count. Pops on click. Users may upvote repeatedly.
export default function UpvoteButton({ count, onUpvote }) {
  const [animating, setAnimating] = useState(false)

  function handleClick() {
    setAnimating(true)
    onUpvote?.()
    window.setTimeout(() => setAnimating(false), 200)
  }

  return (
    <button className="upvote" onClick={handleClick} aria-label={`Upvote (${count})`}>
      <span className={`upvote__icon${animating ? ' upvote__icon--pop' : ''}`}>
        <HeartIcon filled={count > 0} width="18" height="18" />
      </span>
      <span className="upvote__count">{count}</span>
    </button>
  )
}
