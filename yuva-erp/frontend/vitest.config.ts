import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Tests of the screens and of the small helpers: npm run test:ui
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}']
  }
});
