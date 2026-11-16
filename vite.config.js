import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  resolve: { alias: { 'lucide-icons': fileURLToPath(new URL('./node_modules/lucide/dist/esm/icons', import.meta.url)) } },
  server: { host: '0.0.0.0', port: 3000 },
});
