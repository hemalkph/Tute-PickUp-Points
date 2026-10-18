import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Default build = the Vercel app. `--mode cards` = one self-contained cards.html that Apps Script shows in a Sheet dialog.
export default defineConfig(({ mode }) => {
  const cards = mode === 'cards'
  return {
    plugins: [react(), tailwindcss(), ...(cards ? [viteSingleFile()] : [])],
    resolve: { alias: { '@': import.meta.dirname + '/src' } },
    build: cards ? { outDir: 'dist-cards', rollupOptions: { input: 'cards.html' } } : undefined,
  }
})
