// Single source of truth for category + filter metadata, mirrored from the
// design system. CSS reads colors via var(--<key>-*); JS reads labels/emoji here.

export const CATEGORIES = {
  celebration: { key: 'celebration', label: 'Celebration', emoji: '🎉' },
  thankyou: { key: 'thankyou', label: 'Thank You', emoji: '💚' },
  inspiration: { key: 'inspiration', label: 'Inspiration', emoji: '✨' },
}

// Categories a board can actually be (used in the Create Board form).
export const BOARD_CATEGORIES = [
  CATEGORIES.celebration,
  CATEGORIES.thankyou,
  CATEGORIES.inspiration,
]

// Filter pills on the home page. 'all', 'recent', and 'mine' are view-only.
// The 'mine' pill is user-scoped and only rendered when someone is signed in
// (see FilterBar).
export const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'recent', label: 'Recent' },
  { key: 'mine', label: 'My boards', authOnly: true },
  { key: 'celebration', label: 'Celebration' },
  { key: 'thankyou', label: 'Thank You' },
  { key: 'inspiration', label: 'Inspiration' },
]

export function categoryLabel(key) {
  return CATEGORIES[key]?.label ?? key
}
