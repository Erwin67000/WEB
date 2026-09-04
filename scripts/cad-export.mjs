/**
 * Ouvre la page d’export DAE + CSV du serveur Vite local.
 * Cette URL n’existe que pendant `npm run dev` (plugin Vite, pas dans dist).
 */
import { exec } from 'node:child_process'
import { platform } from 'node:os'

const url = process.env.PHILAE_CAD_URL || 'http://127.0.0.1:3102/atelier-cad'

console.log(`
  Philae — export DAE + CSV (dev only)
  ------------------------------------
  ${url}

  Prérequis : npm run dev
  En production (Cloudflare Pages) cette route n’existe pas (HTTP 404).
`)

const cmd =
  platform() === 'win32'
    ? `start "" "${url}"`
    : platform() === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`

exec(cmd, (err) => {
  if (err) {
    console.log('  Ouvre l’URL à la main si le navigateur ne se lance pas.')
  }
})
