import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` → dist/index.html: tek dosya, çift tıklayınca çevrimdışı açılır.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: { assetsInlineLimit: () => true },   // ikonlar dahil her şey dosyanın içine gömülür
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
