// Boards + per-board cards routes — mounted at /api/boards (see src/index.js).
//
// Ownership scoping (see boardsController.ownerScope):
//   - Reads use optionalAuth: signed-in users see only their own boards;
//     guests see the admin user's boards as a public showcase.
//   - All mutations require authenticate (no anonymous writes).
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
import { authenticate, optionalAuth } from '../middleware/authenticate.js'

const router = Router()

// Boards
router.get('/', optionalAuth, validateListBoardsQuery, listBoards)
router.get('/:boardId', optionalAuth, getBoard)
router.post('/', authenticate, validateCreateBoard, createBoard)
router.delete('/:boardId', authenticate, deleteBoard)

// Cards nested under a board
router.get('/:boardId/cards', optionalAuth, listCards)
router.post('/:boardId/cards', authenticate, validateCreateCard, createCard)
router.delete('/:boardId/cards/:cardId', authenticate, deleteCard)
router.patch('/:boardId/cards/:cardId/upvote', authenticate, upvoteCard)
router.patch('/:boardId/cards/:cardId/pin', authenticate, validatePin, pinCard)

export default router
