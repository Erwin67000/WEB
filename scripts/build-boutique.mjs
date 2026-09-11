/**
 * Met à jour la boutique depuis le tableau atelier :
 *   src/1_STRUCTURE/03_bibliotheque/modele_boutique.csv
 *
 *   1. recopie le CSV vers public/catalogue (UTF-8 + XLSX)
 *   2. génère un GLB 3D par modèle actif
 *
 * Usage (à la racine du projet WEB) :
 *
 *   npm run boutique
 *
 * Puis recharger /boutique dans le navigateur (Ctrl+F5).
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const node = process.execPath

function run(script, label) {
  console.log(`\n── ${label} ──`)
  const r = spawnSync(node, [path.join(root, 'scripts', script)], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })
  if (r.status !== 0) {
    console.error(`[boutique] échec : ${script}`)
    process.exit(r.status || 1)
  }
}

console.log('Philae — régénération boutique')
console.log('Source : src/1_STRUCTURE/03_bibliotheque/modele_boutique.csv')
run('sync-catalogue.mjs', '1/2  Sync catalogue')
run('generate-catalogue-glbs.mjs', '2/2  Géométrie GLB')
console.log('\n[boutique] OK — ouvre /boutique (Ctrl+F5).')
