import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The frontend talks to the Express API at /api. In dev we proxy to localhost:3000
// so the backend can run separately (see backend/). Override with VITE_API_BASE_URL.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
