import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Configuration Vite partagée par le web et Tauri.
// WebKitGTK 4.1 (Ubuntu 24.04) ~ Safari 14 / Chrome 90 → cible es2021
export default defineConfig({
  plugins: [svelte({ configFile: './svelte.config.js' })],
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: { target: 'es2021' },
  // Évite les imports dynamiques top-level qui peuvent bloquer le démarrage
  // dans des webviews anciens
  esbuild: { supported: { 'top-level-await': false } },
});
