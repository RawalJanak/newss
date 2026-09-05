import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Builds straight into ../app so the built index.html + assets sit next to
// the existing articles.json / markets.json that the Python digest pipeline
// writes. base:'./' keeps asset URLs relative so it works under GitHub
// Pages' /newss/app/ subpath without hardcoding the repo name.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../app',
    emptyOutDir: false,
  },
})
