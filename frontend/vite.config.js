import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:2087',
      '/chat': 'http://localhost:2087',
      '/trips': 'http://localhost:2087',
      '/webhooks': 'http://localhost:2087',
      '/user': 'http://localhost:2087',
      '/emails': 'http://localhost:2087',
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})