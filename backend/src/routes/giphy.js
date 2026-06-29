// GIPHY proxy routes — mounted at /api/giphy (see src/index.js).
import { Router } from 'express'
import { search } from '../controllers/giphyController.js'

const router = Router()

// Search GIFs. Paths are relative to the mount point, so this is /api/giphy/search.
router.get('/search', search)

export default router
