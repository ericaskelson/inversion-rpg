import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // For GitHub Pages: set VITE_BASE_PATH=/repo-name/ when building
  // For local dev or root deployment: leave unset (defaults to /)
  base: process.env.VITE_BASE_PATH || '/',
})
