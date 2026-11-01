import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Un solo dist/index.html con todo dentro: se abre con doble clic y sin internet.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { assetsInlineLimit: Infinity, chunkSizeWarningLimit: 20000 },
});
