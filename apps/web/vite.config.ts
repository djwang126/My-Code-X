/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      injectRegister: false,
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false,
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'My Code X',
        short_name: 'MyCodeX',
        description: 'Phone-friendly web chat for local Codex',
        theme_color: '#FFFFFF',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,webmanifest}'],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ request, url }) => request.mode === 'navigate' && !url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-shell-documents',
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: ({ request, url }) =>
              url.pathname.startsWith('/assets/') ||
              request.destination === 'script' ||
              request.destination === 'style' ||
              request.destination === 'worker',
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-shell-assets',
              expiration: {
                maxEntries: 32,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.pathname === '/manifest.webmanifest' ||
              url.pathname === '/favicon.svg' ||
              url.pathname === '/apple-touch-icon.png' ||
              url.pathname.endsWith('.png'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-shell-metadata',
              expiration: {
                maxEntries: 16,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@my-code-x/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
      '@my-code-x/utils/error-code': path.resolve(__dirname, '../../packages/utils/src/error-code.ts'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 3210,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4310',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    testTimeout: 10_000,
  },
});
