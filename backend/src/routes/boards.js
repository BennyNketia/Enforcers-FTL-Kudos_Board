// Boards + per-board cards routes — mounted at /api/boards (see src/index.js).
import { Router } from 'express'

import {
  listBoards,
  getBoard,
  createBoard,
  deleteBoard,
} from '../controllers/boardsController.js'
import {
  listCards,
  createCard,
  deleteCard,
  upvoteCard,
  pinCard,
} from '../controllers/cardsController.js'
import {
  validateCreateBoard,
  validateListBoardsQuery,
  validateCreateCard,
  validatePin,
} from '../middleware/validate.js'

const router = Router()

// Boards
router.get('/', validateListBoardsQuery, listBoards)
router.get('/:boardId', getBoard)
router.post('/', validateCreateBoard, createBoard)
router.delete('/:boardId', deleteBoard)

// Cards nested under a board
router.get('/:boardId/cards', listCards)
router.post('/:boardId/cards', validateCreateCard, createCard)
router.delete('/:boardId/cards/:cardId', deleteCard)
router.patch('/:boardId/cards/:cardId/upvote', upvoteCard)
router.patch('/:boardId/cards/:cardId/pin', validatePin, pinCard)

export default router
