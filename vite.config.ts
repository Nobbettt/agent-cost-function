import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      // Multi-page: the calculator at /, plus /how-it-works/, /sources/ and /cache-break-even/.
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        sources: resolve(import.meta.dirname, 'sources/index.html'),
        howItWorks: resolve(import.meta.dirname, 'how-it-works/index.html'),
        cacheBreakEven: resolve(import.meta.dirname, 'cache-break-even/index.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    // Full-App integration tests render the whole page in jsdom and use Testing Library's whole-DOM queries; on a
    // 2-vCPU CI runner with coverage on they are legitimately several times slower than on a laptop.
    testTimeout: 20_000,
    // CI runners have 2 vCPUs: more workers than that only time-slice the same two cores, which stretches every test.
    ...(process.env.CI ? { maxWorkers: 2 } : {}),
    coverage: {
      provider: 'v8',
      include: ['src/model/**', 'src/format.ts', 'src/data/**', 'src/hooks/**', 'src/currency/**'],
      exclude: ['src/**/*.test.ts', 'src/model/types.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})
