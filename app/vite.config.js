import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative base so the built assets resolve correctly whether this ends
  // up served from a domain root or a GitHub Pages project subpath —
  // HashRouter already makes routing itself base-agnostic.
  base: './',
  server: { port: 5173, strictPort: false, host: '0.0.0.0' }
})
