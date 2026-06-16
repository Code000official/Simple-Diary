import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    // 开发时将 /api 请求代理到后端服务器
    // 这样前端代码中可以统一使用 /api 前缀，无需关心 CORS
    proxy: {
      '/api': {
        target: 'http://localhost:4567',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:4567',
        changeOrigin: true,
      },
    },
  },
})
