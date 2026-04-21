import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'

export default defineConfig({
  plugins: [
    react(),
    ViteImageOptimizer({
      png:  { quality: 80 },
      jpg:  { quality: 80 },
      jpeg: { quality: 80 },
      webp: { lossless: false, quality: 80 },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames:  'assets/[name]-[hash].js',
        entryFileNames:  'assets/[name]-[hash].js',
      },
    },
  },
})
