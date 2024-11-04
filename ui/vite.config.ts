import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

const backendPort = parseInt(process.env.PORT) || 7000

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '^/api/.*': `http://localhost:${backendPort}`,
      '^/socket.io': {
        target: `ws://localhost:${backendPort}`,
        ws: true,
        rewriteWsOrigin: true,
      }
    }
  }
})
