// Auth routes — mounted at /api/auth (see src/index.js).
import { Router } from 'express'
import { signup, login, logout, me } from '../controllers/authController.js'
import { optionalAuth } from '../middleware/authenticate.js'

const router = Router()

router.post('/signup', signup)
router.post('/login', login)
router.post('/logout', logout)
// optionalAuth so a guest (no/invalid token) gets a clean `null` instead of 401.
router.get('/me', optionalAuth, me)

export default router
