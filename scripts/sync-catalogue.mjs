/**
 * Source unique des modèles préconfigurés :
 *   src/1_STRUCTURE/03_bibliotheque/modele_boutique.csv
 *
 * Copie vers public pour le navigateur + scripts GLB :
 *   public/catalogue/modele_boutique.csv
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(
  root,
  'src/1_STRUCTURE/03_bibliotheque/modele_boutique.csv',
)
const targetDir = path.join(root, 'public/catalogue')
const target = path.join(targetDir, 'modele_boutique.csv')

if (!fs.existsSync(source)) {
  console.error('[sync:catalogue] ERREUR : source introuvable', source)
  process.exit(1)
}

fs.mkdirSync(targetDir, { recursive: true })
fs.copyFileSync(source, target)
console.log(
  '[sync:catalogue]',
  path.relative(root, source),
  '→',
  path.relative(root, target),
)

// Nettoyage anciens doublons structure
const legacy = path.join(
  root,
  'public/structure/08_bibliotheque/models/boutique/matrice_catalogue.csv',
)
if (fs.existsSync(legacy)) {
  try {
    fs.unlinkSync(legacy)
    console.log('[sync:catalogue] supprimé', path.relative(root, legacy))
  } catch {
    /* ignore */
  }
}
