// Boards controllers — planning.md §2.1.
//
// Wire format: `cardCount` is derived (Prisma _count); createdAt is epoch ms.
// Errors flow through next(err) to the central handler in src/index.js.

import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { serializeBoard } from '../lib/serialize.js'

const DEFAULT_COVERS = {
  celebration: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&q=80',
  thankyou: 'https://images.unsplash.com/photo-1606857521015-7f9fcf423740?w=800&q=80',
  inspiration: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=800&q=80',
}

const COUNT_SELECT = { _count: { select: { cards: true } } }

// GET /api/boards?filter&search
export async function listBoards(req, res, next) {
  try {
    const filter = req.query.filter || 'all'
    const search = (req.query.search || '').trim()

    const where = {}
    if (filter !== 'all' && filter !== 'recent') where.category = filter
    if (search) where.title = { contains: search, mode: 'insensitive' }

    const boards = await prisma.board.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filter === 'recent' ? 6 : undefined,
      include: COUNT_SELECT,
    })

    res.json(boards.map(serializeBoard))
  } catch (err) {
    next(err)
  }
}

// GET /api/boards/:boardId
export async function getBoard(req, res, next) {
  try {
    const board = await prisma.board.findUnique({
      where: { id: req.params.boardId },
      include: COUNT_SELECT,
    })
    if (!board) return res.status(404).json({ error: 'Board not found.' })
    res.json(serializeBoard(board))
  } catch (err) {
    next(err)
  }
}

// POST /api/boards
export async function createBoard(req, res, next) {
  try {
    const { title, category, imageUrl, author } = req.body
    const board = await prisma.board.create({
      data: {
        title: title.trim(),
        category,
        imageUrl: imageUrl?.trim() || DEFAULT_COVERS[category],
        author: author?.trim() || null,
      },
      include: COUNT_SELECT,
    })
    res.status(201).json(serializeBoard(board))
  } catch (err) {
    next(err)
  }
}

// DELETE /api/boards/:boardId  → 204, cascades to cards via schema.
export async function deleteBoard(req, res, next) {
  try {
    await prisma.board.delete({ where: { id: req.params.boardId } })
    res.status(204).end()
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Board not found.' })
    }
    next(err)
  }
}
