import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      // Multi-page: the calculator at / and the sources page at /sources/.
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        sources: resolve(import.meta.dirname, 'sources/index.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/model/**', 'src/format.ts', 'src/data/**'],
      exclude: ['src/**/*.test.ts', 'src/model/types.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})
