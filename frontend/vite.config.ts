import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev: proxy API calls to the Spring Boot backend.
// Prod: we plan to serve the built SPA under /app/ from Spring Boot static resources.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/app/' : '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/actuator': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
}))
