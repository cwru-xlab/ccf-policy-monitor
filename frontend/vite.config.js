import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Use the correct base path for each hosting platform
export default defineConfig({
  plugins: [react()],
  base: process.env.VERCEL ? '/' : '/policy-reviewer/',
})
