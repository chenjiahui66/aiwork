import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  plugins: [vue()],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5175,
    // 代理 /api/* 到 aiwork-backend (FastAPI 8001)
    // 这样前端调 /api/chat 不用考虑 CORS, 直接透传到后端
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      // 代理 Dify 工作流 API,避免浏览器 CORS
      // 前端调 /dify-api/v1/workflows/run → 实际打到 http://localhost/v1/workflows/run
      '/dify-api': {
        target: 'http://127.0.0.1',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/dify-api/, ''),
      },
    },
  },
  build: {
    target: 'es2018',
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
})