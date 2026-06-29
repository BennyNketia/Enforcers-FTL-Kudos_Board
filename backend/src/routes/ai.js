// AI routes — mounted at /api/ai (see src/index.js).
import { Router } from 'express'
import { compose, suggestGifs } from '../controllers/aiController.js'

const router = Router()

// "Help me write" composer.
router.post('/compose', compose)

// AI GIF-term suggester (teammate's feature — currently a 501 stub).
router.post('/suggest-gifs', suggestGifs)

export default router
