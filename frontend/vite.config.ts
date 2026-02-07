import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import type { PluginOption } from 'vite'

export default defineConfig(async ({ mode }) => {
  const plugins: PluginOption[] = [react()]

  if (mode === 'analyze') {
    try {
      const { visualizer } = await import('rollup-plugin-visualizer')
      plugins.push(
        visualizer({
          filename: 'dist/bundle-analysis.html',
          gzipSize: true,
          brotliSize: true,
          open: false,
        })
      )
    } catch {
      // Keep regular build usable when analyzer dependency is not installed.
      console.warn('Bundle analyzer disabled: install "rollup-plugin-visualizer" to enable it.')
    }
  }

  return {
    plugins,
    define: {
      global: 'globalThis',
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules/plotly.js') || id.includes('node_modules/react-plotly.js')) {
              return 'plotly-vendor'
            }
            if (id.includes('node_modules/@tanstack')) {
              return 'tanstack-vendor'
            }
            return undefined
          },
        },
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/ws': {
          target: 'ws://localhost:8000',
          ws: true,
        },
      },
    },
  }
})
