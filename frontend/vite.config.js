import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // The storefront's audience is largely on mid/low-end Android over Indian 4G, so the single
    // ~930 kB bundle is split into cache-stable vendor chunks. React and MUI change only when we
    // upgrade them, so a normal app deploy no longer invalidates ~600 kB of unchanged library code.
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-mui': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          'vendor-misc': ['axios', 'react-slick', 'slick-carousel', 'react-helmet-async'],
        },
      },
    },
    // 600 kB is above the largest chunk we now emit; this keeps the warning meaningful rather
    // than permanently firing.
    chunkSizeWarningLimit: 600,
  },
})
