import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const cspPlugin = () => ({
  name: 'inject-csp',
  transformIndexHtml(html) {
    if (process.env.NODE_ENV !== 'production') return html;
    const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://*.sentry.io https://foundry-ai.timberandcode3.workers.dev; img-src 'self' data: blob:;" />`;
    return html.replace('</head>', `  ${csp}\n</head>`);
  },
});

export default defineConfig({
  plugins: [react(), cspPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['e2e/**', 'node_modules/**'],
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV !== 'production',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'data-exercises': ['./src/data/exercises.js'],
        },
      },
    },
  },
});
