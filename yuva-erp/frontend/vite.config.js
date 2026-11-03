import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The app talks to the server (backend, Express) through /api.
// In development Vite forwards those calls, so other computers only need port 3000.
// xfwd passes the real address of the caller on, so the server can count failed sign-ins per computer
const api = { '/api': { target: 'http://localhost:3001', changeOrigin: false, xfwd: true } }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: api },
  preview: { proxy: api },
})
