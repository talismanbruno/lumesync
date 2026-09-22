/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/favicon-32.png', 'icons/favicon-16.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Lume',
        short_name: 'Lume',
        description: 'Comunicação em tempo real para conversar, criar comunidades e compartilhar momentos.',
        display: 'standalone',
        start_url: '/channels/@me',
        id: '/',
        lang: 'pt-BR',
        theme_color: '#050505',
        background_color: '#050505',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/ws/, /^\/uploads/],
        skipWaiting: false,
        clientsClaim: false,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Cache only the app shell during install. Optional mobile screens,
        // desktop panels and admin tools are fetched when opened instead of
        // costing every phone user data on each release.
        globPatterns: [
          'index.html',
          'assets/index-*.css',
          'assets/index-*.js',
          'assets/app-runtime-*.js',
          'assets/voice-runtime-*.js',
          'assets/rich-text-*.js',
        ],
        runtimeCaching: [{
          urlPattern: ({ sameOrigin, url }) =>
            sameOrigin && url.pathname.startsWith('/assets/') && /\.(js|wasm)$/.test(url.pathname),
          handler: 'CacheFirst',
          options: {
            cacheName: 'lume-on-demand-assets',
            cacheableResponse: { statuses: [200] },
            expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 },
          },
        }],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.mts', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('livekit') || id.includes('@sapphi-red')) return 'voice-runtime';
          if (id.includes('@emoji-mart')) return 'emoji-picker';
          if (id.includes('react-markdown') || id.includes('remark-') || id.includes('prism-react-renderer')) return 'rich-text';
          if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/') || id.includes('zustand')) return 'app-runtime';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3005',
        ws: true,
      },
    },
  },
});
