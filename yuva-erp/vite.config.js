import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The app talks to the server (server/db-server.mjs) through /api.
// In development Vite forwards those calls, so other computers only need port 3000.
const api = { '/api': { target: 'http://localhost:3001', changeOrigin: false } }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: api },
  preview: { proxy: api },
})
