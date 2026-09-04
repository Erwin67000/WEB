/**
 * Export interne DAE + CSV — pas exposé au client.
 *
 * 1. Configurateur ouvert (npm run dev)
 * 2. npm run cad
 *    → ouvre /atelier-cad  (état courant, ou dernier brouillon local)
 *
 * Console navigateur, sur /configurateur :
 *    philaeCad()
 */
import { exec } from 'node:child_process'
import { platform } from 'node:os'

const url = process.env.PHILAE_CAD_URL || 'http://127.0.0.1:3102/atelier-cad'

console.log(`
  Philae — export DAE + CSV (interne)
  -----------------------------------
  Page secrète : ${url}
  Console      : philaeCad()   (onglet /configurateur)

  Le bouton client a été retiré. Cette page n’est pas dans le menu.
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
