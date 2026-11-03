import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/',
  build: {
    // 直接输出到后端的 web 目录；emptyOutDir=false 以保留 WEB-INF
    outDir: '../web',
    emptyOutDir: false
  },
  server: {
    host: '0.0.0.0',
    port: 8173,
    proxy: {
      '/api': 'http://127.0.0.1:8088'
    }
  }
})
