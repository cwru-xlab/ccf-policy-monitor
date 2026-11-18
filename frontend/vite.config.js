import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    // Dev only: forward /api/* to the FastAPI backend so the browser stays same-origin.
    // Production on Vercel does the same via api/proxy.mjs (API_ORIGIN). VITE_API_URL
    // calls the API directly instead, which uses CORS_ORIGINS on the API.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
