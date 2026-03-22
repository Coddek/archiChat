import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    // Le decimos a Vitest que @/ apunta a la raíz del proyecto
    // igual que está configurado en Next.js
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
