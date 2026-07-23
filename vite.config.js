import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
/** Monorepo philae (frère de sauvegarde/) */
const monorepoRoot = path.resolve(rootDir, '../..')
const structureRoot = path.join(monorepoRoot, '01_structure')
const boutiqueDir = path.join(
  structureRoot,
  '08_bibliotheque',
  'models',
  'boutique',
)

/**
 * Sert /structure/* depuis le monorepo (matrice_catalogue, GLB, docs…).
 * Priorité monorepo ; sinon public/structure.
 */
function structureStaticPlugin() {
  return {
    name: 'philae-structure-static',
    configureServer(server) {
      server.middlewares.use('/structure', (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '/'
        const decoded = decodeURIComponent(url).replace(/^\//, '')
        const candidates = [
          path.join(structureRoot, decoded),
          path.join(rootDir, 'public', 'structure', decoded),
        ]
        const filePath = candidates.find(
          (p) => fs.existsSync(p) && fs.statSync(p).isFile(),
        )
        if (!filePath) {
          next()
          return
        }
        const ext = path.extname(filePath).toLowerCase()
        const types = {
          '.csv': 'text/csv; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.glb': 'model/gltf-binary',
          '.gltf': 'model/gltf+json',
          '.pdf': 'application/pdf',
          '.svg': 'image/svg+xml',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.md': 'text/markdown; charset=utf-8',
        }
        res.setHeader('Content-Type', types[ext] ?? 'application/octet-stream')
        res.setHeader('Cache-Control', 'no-cache')
        fs.createReadStream(filePath).pipe(res)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), structureStaticPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@matrice': fileURLToPath(
        new URL('./src/1_STRUCTURE/00_matrice', import.meta.url),
      ),
      '@meuble3D': fileURLToPath(
        new URL('./src/1_STRUCTURE/01_meuble3D', import.meta.url),
      ),
      '@agencement': fileURLToPath(
        new URL('./src/1_STRUCTURE/02_agencement', import.meta.url),
      ),
      '@biblio': fileURLToPath(
        new URL('./src/1_STRUCTURE/03_bibliotheque', import.meta.url),
      ),
      '@build': fileURLToPath(new URL('./src/2_BUILD', import.meta.url)),
      '@catalogue-csv': path.join(boutiqueDir, 'matrice_catalogue.csv'),
    },
    dedupe: ['three', 'react', 'react-dom'],
  },
  optimizeDeps: {
    include: [
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      'zustand',
      'react-router-dom',
    ],
  },
  server: {
    port: 3102,
    host: true,
    strictPort: true,
    fs: {
      allow: [rootDir, monorepoRoot, structureRoot, boutiqueDir],
    },
    watch: {
      ignored: [
        '**/dist/**',
        '**/.git/**',
        '**/node_modules/**',
        '**/*.md',
      ],
    },
  },
  publicDir: 'public',
  build: {
    chunkSizeWarningLimit: 1500,
  },
})
