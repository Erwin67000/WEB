/**
 * Source unique du catalogue boutique :
 *   public/catalogue/matrice_catalogue.csv
 *
 * Si le monorepo expose encore un CSV, on le copie ICI (édition atelier).
 * Sinon on ne fait rien (la boutique lit public/catalogue uniquement).
 *
 * Plus de double copie sous public/structure/...
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const monorepoCsv = path.resolve(
  root,
  '../../01_structure/08_bibliotheque/models/boutique/matrice_catalogue.csv',
)
const target = path.join(root, 'public/catalogue/matrice_catalogue.csv')

// Nettoyage de l’ancien doublon structure (ne sert plus)
const legacy = path.join(
  root,
  'public/structure/08_bibliotheque/models/boutique/matrice_catalogue.csv',
)

if (fs.existsSync(monorepoCsv)) {
  // Monorepo plus récent que public → on importe
  const monoStat = fs.statSync(monorepoCsv)
  const pubExists = fs.existsSync(target)
  const pubStat = pubExists ? fs.statSync(target) : null
  if (!pubExists || monoStat.mtimeMs > (pubStat?.mtimeMs || 0)) {
    // Si monorepo est plus petit (ancien) et public a plus de lignes, garder public
    const monoLines = fs.readFileSync(monorepoCsv, 'utf8').trim().split(/\n/).length
    const pubLines = pubExists
      ? fs.readFileSync(target, 'utf8').trim().split(/\n/).length
      : 0
    if (!pubExists || monoLines >= pubLines) {
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, fs.readFileSync(monorepoCsv))
      console.log('[sync:catalogue] import monorepo →', path.relative(root, target))
    } else {
      console.log(
        '[sync:catalogue] conserve public/catalogue (plus complet que monorepo)',
      )
    }
  } else {
    console.log('[sync:catalogue] public/catalogue à jour')
  }
} else {
  console.log('[sync:catalogue] monorepo absent — source =', path.relative(root, target))
}

if (fs.existsSync(legacy)) {
  fs.unlinkSync(legacy)
  console.log('[sync:catalogue] supprimé doublon', path.relative(root, legacy))
}

if (!fs.existsSync(target)) {
  console.error('[sync:catalogue] ERREUR : catalogue manquant', target)
  process.exit(1)
}
console.log('[sync:catalogue] source unique : public/catalogue/matrice_catalogue.csv')
