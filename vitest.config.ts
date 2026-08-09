import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.resolve(rootDir, 'src')

export default defineConfig({
  root: rootDir,
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: `${srcDir.replace(/\\/g, '/')}/`
      }
    ]
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [path.resolve(rootDir, 'tests/setup.ts')],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx']
  }
})
