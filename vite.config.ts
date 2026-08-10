import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png'],
      manifest: {
        name: 'BINGOUP - Sistema de Bingo Computadorizado',
        short_name: 'BINGOUP',
        description: 'Plataforma PWA multi-organizador para gestão de eventos de bingo.',
        theme_color: '#0b0d11',
        background_color: '#0b0d11',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'pt-BR',
        icons: [
          {
            src: '/pwa-icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // Dados autenticados do Supabase nunca entram no cache do Service Worker.
        // O app shell continua disponível offline, mas dados de workspace/evento sempre vêm da sessão atual.
        runtimeCaching: []
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src')
    }
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true }
})
