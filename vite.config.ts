import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    // ⬇️ Évite "EMFILE: too many open files" causé par lucide-react (1500+ fichiers d'icônes)
    rollupOptions: {
      maxParallelFileOps: 10,
      output: {
        // ⬇️ Découpe le bundle de 1 Mo en chunks plus petits
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router'],
          'supabase': ['@supabase/supabase-js'],
          'ui-icons': ['lucide-react'],
          'charts': ['recharts'],
          'motion': ['motion'],
        },
      },
    },
    // ⬇️ Augmente la limite d'avertissement (le bundle était à 1 Mo)
    chunkSizeWarningLimit: 1500,
  },
})