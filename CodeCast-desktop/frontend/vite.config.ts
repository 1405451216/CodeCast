import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const isAnalyze = process.env.ANALYZE === 'true';

let plugins = [react()];

if (isAnalyze) {
  const { visualizer } = await import('rollup-plugin-visualizer');
  plugins.push(
    visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    })
  );
}

export default defineConfig({
  plugins: plugins,
  root: '.',
  base: './',
  resolve: {
    alias: {
      '@wailsjs': resolve(__dirname, 'wailsjs'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-dom/client'],
          'vendor-markdown': ['marked', 'highlight.js', 'katex', 'mermaid', 'dompurify'],
          'vendor-state': ['zustand'],
          'vendor-virtual': ['@tanstack/react-virtual'],
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'assets/css/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    chunkSizeWarningLimit: 500 * 1024,
    reportCompressedSize: false,
  },
  server: {
    port: 5173,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand', '@tanstack/react-virtual'],
  },
});
