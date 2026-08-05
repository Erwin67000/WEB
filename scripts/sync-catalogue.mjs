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

// Source parfois en Latin-1 (LibreOffice Windows) — normalise en UTF-8 + BOM
const raw = fs.readFileSync(source)
let text = raw.toString('utf8')
const looksBroken =
  text.includes('\uFFFD') ||
  (/Biblioth.|entr.|Etag.|Si.ge|Ext.rieur/.test(text) &&
    !/Bibliothèque|entrée|Etagère|Siège|Extérieur/.test(text))
if (looksBroken) {
  text = raw.toString('latin1')
  console.log('[sync:catalogue] reconversion Latin-1 → UTF-8')
}
text = '\uFEFF' + text.replace(/^\uFEFF/, '')
fs.writeFileSync(target, text, 'utf8')
console.log(
  '[sync:catalogue]',
  path.relative(root, source),
  '→',
  path.relative(root, target),
  '(UTF-8)',
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
