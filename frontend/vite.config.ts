import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // Our own read-only Hasura mirror (hasura/README.md) — proxied the
      // same way as /api so the browser only ever talks to one origin.
      // ws: true lets Vite's proxy also forward the graphql-ws upgrade
      // request subscriptions use, not just plain HTTP queries.
      '/hasura': {
        target: 'http://localhost:8091',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/hasura/, ''),
      },
    },
  },
});
