import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// InfraStudio is the single unified product UI, served at the gateway root `/`.
// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    // Split large vendor libraries into their own cacheable chunks instead of
    // one ~2.2 MB blob. Heavy deps (pdf, ocr, spreadsheet, editor) only load on
    // the routes/components that import them.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          reactflow: ['reactflow'],
          motion: ['framer-motion'],
          editor: ['@monaco-editor/react'],
          pdf: ['pdfjs-dist', 'jspdf'],
          export: ['xlsx', 'jszip', 'html2canvas'],
          ocr: ['tesseract.js'],
        },
      },
    },
  },
  server: {
    port: 8087,
    host: true,
    strictPort: true,
    proxy: {
      // InfraStudio's own pricing/AI/stripe/settings backend (native routes are /api/*).
      // The gateway rewrites /studio-api/ -> /api/; we mirror that here for dev parity.
      '/studio-api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/studio-api/, '/api'),
      },
      // Oz control-plane API (auth, agents) — used by the Deploy-to-Oz bridge.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
