import { CATEGORIES } from '../lib/categories.js'
import './CategoryTag.css'

// Small category chip. Colors come from per-category CSS vars.
export default function CategoryTag({ category }) {
  const meta = CATEGORIES[category]
  if (!meta) return null
  return (
    <span className={`category-tag category-tag--${category} t-tag`}>
      <span aria-hidden>{meta.emoji}</span>
      {meta.label}
    </span>
  )
}
