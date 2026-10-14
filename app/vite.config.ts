import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    // Country flags stay separate files (fetched only when displayed)
    // instead of being inlined in the JS bundle as data URIs.
    assetsInlineLimit: (file) => (file.includes("country-flag-icons") ? false : undefined),
  },
})
