import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'robots.txt'],
      manifest: {
        name: 'EcoScan',
        short_name: 'EcoScan',
        description: 'Prototipo demostrativo de EcoScan. Datos de ejemplo.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Si la app está instalada, abrir el enlace del demo la abre en la ventana instalada
        handle_links: 'preferred',
        launch_handler: { client_mode: ['navigate-existing', 'auto'] },
        lang: 'es',
        theme_color: '#176B4D',
        background_color: '#F6F8F5',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
    }),
  ],
})
