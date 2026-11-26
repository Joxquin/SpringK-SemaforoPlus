import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api/v1/iot': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/api/v1/realtime': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/api/v1': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
    },
  },
})
