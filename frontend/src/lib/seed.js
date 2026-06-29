// Seed data so the app shows content on first load (localStorage mode only).
// Once the real backend is in use (VITE_USE_API=true), seeding is bypassed.

const DAY = 24 * 60 * 60 * 1000

export function seedBoards() {
  const now = Date.now()
  return [
    {
      id: 'seed-board-1',
      title: 'Q2 Launch Wins',
      category: 'celebration',
      imageUrl: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&q=80',
      author: 'Benny',
      createdAt: now - 1 * DAY,
    },
    {
      id: 'seed-board-2',
      title: 'Thanks, Support Team!',
      category: 'thankyou',
      imageUrl: 'https://images.unsplash.com/photo-1606857521015-7f9fcf423740?w=800&q=80',
      author: 'Maya',
      createdAt: now - 2 * DAY,
    },
    {
      id: 'seed-board-3',
      title: 'Monday Motivation',
      category: 'inspiration',
      imageUrl: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=800&q=80',
      author: 'Jordan',
      createdAt: now - 3 * DAY,
    },
    {
      id: 'seed-board-4',
      title: 'Welcome New Hires 🎊',
      category: 'celebration',
      imageUrl: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&q=80',
      author: 'HR Team',
      createdAt: now - 4 * DAY,
    },
  ]
}

export function seedCards() {
  const now = Date.now()
  return [
    {
      id: 'seed-card-1',
      boardId: 'seed-board-1',
      message: 'Incredible work shipping the new dashboard ahead of schedule! 🚀',
      gifUrl: 'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif',
      author: 'Benny',
      upvotes: 7,
      pinned: true,
      pinnedAt: now - 1000,
      createdAt: now - 5000,
    },
    {
      id: 'seed-card-2',
      boardId: 'seed-board-1',
      message: 'The launch demo was flawless. Proud of this team!',
      gifUrl: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif',
      author: '',
      upvotes: 3,
      pinned: false,
      pinnedAt: null,
      createdAt: now - 4000,
    },
    {
      id: 'seed-card-3',
      boardId: 'seed-board-2',
      message: 'Thank you for staying late to resolve the outage. You rock! 💚',
      gifUrl: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
      author: 'Maya',
      upvotes: 12,
      pinned: false,
      pinnedAt: null,
      createdAt: now - 3000,
    },
  ]
}
