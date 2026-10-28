import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 3000 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/three/build/three.core')) return 'three-core';
          if (id.includes('/three/build/')) return 'three-renderer';
          if (id.includes('/three/examples/')) return 'three-addons';
          if (id.includes('/lucide/')) return 'icons';
        },
      },
    },
  },
});
