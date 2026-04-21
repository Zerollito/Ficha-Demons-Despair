import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          // Garante que o Service Worker NÃO intercepte rotas de API
          navigateFallbackDenylist: [/^\/api/],
          runtimeCaching: [
            {
              urlPattern: /^\/api\/.*/i,
              handler: 'NetworkOnly', // Força as chamadas de API a irem sempre para o servidor real
            }
          ]
        },
        manifest: {
          name: 'Ficha RPG Demons Despair',
          short_name: 'Demons Despair',
          description: 'Ficha automatizada para o sistema Demons Despair',
          theme_color: '#18181b',
          background_color: '#09090b',
          display: 'standalone',
          icons: [
            {
              src: 'd20.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'd20.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
