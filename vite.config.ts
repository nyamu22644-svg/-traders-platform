import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'official-dbot-legacy-asset-rewrite',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const url = req.url || '';
            const referer = req.headers.referer || '';
            const isOfficialDbotRequest = referer.includes('/official-dbot/');
            const isLegacyPath =
              url.startsWith('/static/') ||
              url.startsWith('/assets/') ||
              url.startsWith('/js/smartcharts/');

            if (isOfficialDbotRequest && isLegacyPath) {
              res.statusCode = 302;
              res.setHeader('Location', `/official-dbot${url}`);
              res.end();
              return;
            }

            next();
          });
        },
      },
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
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
