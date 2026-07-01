// Boards + per-board cards routes — mounted at /api/boards (see src/index.js).
//
// Access model:
//   - Reads are global (everyone sees everything). optionalAuth still runs
//     so the serializer can stamp `isOwner` for the caller — used by the
//     frontend to hide delete buttons on rows the user doesn't own.
//   - All mutations require authenticate (no anonymous writes).
//   - Delete checks live in the controllers: only the creator may delete.
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
  listReplies,
  createReply,
  deleteReply,
  likeReply,
} from '../controllers/repliesController.js'
import {
  validateCreateBoard,
  validateListBoardsQuery,
  validateCreateCard,
  validateCreateReply,
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

// Replies nested under a card
router.get('/:boardId/cards/:cardId/replies', optionalAuth, listReplies)
router.post('/:boardId/cards/:cardId/replies', authenticate, validateCreateReply, createReply)
router.delete('/:boardId/cards/:cardId/replies/:replyId', authenticate, deleteReply)
router.patch('/:boardId/cards/:cardId/replies/:replyId/like', authenticate, likeReply)

export default router
