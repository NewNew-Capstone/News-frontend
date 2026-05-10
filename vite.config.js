import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = (
    env.VITE_API_PROXY_TARGET ||
    'http://localhost:8080'
  ).replace(/\/$/, '')

  return {
    plugins: [react()],
    server: {
      port: 3000,
      // Prefer 3000, but fall back to the next open port during local development.
      strictPort: false,
      proxy: proxyTarget
        ? {
            '/api': {
              target: proxyTarget,
              changeOrigin: true,
              configure: (proxy) => {
                proxy.on('error', (error) => {
                  console.error(`[vite-proxy] Failed to reach ${proxyTarget}: ${error.message}`)
                })
              },
            },
          }
        : undefined,
    },
  }
})
