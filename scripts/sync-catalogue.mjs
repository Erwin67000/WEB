/**
 * Copie matrice_catalogue.csv du monorepo vers public/
 * pour le build / preview hors middleware Vite.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const monorepoCsv = path.resolve(
  root,
  '../../01_structure/08_bibliotheque/models/boutique/matrice_catalogue.csv',
)
const targets = [
  path.join(
    root,
    'public/structure/08_bibliotheque/models/boutique/matrice_catalogue.csv',
  ),
  path.join(root, 'public/catalogue/matrice_catalogue.csv'),
]

if (!fs.existsSync(monorepoCsv)) {
  console.warn(
    '[sync:catalogue] monorepo CSV introuvable — conserve les copies public/ existantes',
  )
  console.warn('  attendu :', monorepoCsv)
  process.exit(0)
}

const src = fs.readFileSync(monorepoCsv)
for (const dest of targets) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, src)
  console.log('[sync:catalogue]', path.relative(root, dest))
}
