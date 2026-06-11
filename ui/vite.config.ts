import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: '../ui-dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
  },
});
