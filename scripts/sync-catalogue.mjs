/**
 * Source unique des modèles préconfigurés :
 *   src/1_STRUCTURE/03_bibliotheque/modele_boutique.xls  (prioritaire)
 *   src/1_STRUCTURE/03_bibliotheque/modele_boutique.csv
 *
 * Copie vers public pour le navigateur + scripts GLB :
 *   public/catalogue/modele_boutique.xls
 *   public/catalogue/modele_boutique.csv
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const xlsSource = path.join(
  root,
  'src/1_STRUCTURE/03_bibliotheque/modele_boutique.xls',
)
const csvSource = path.join(
  root,
  'src/1_STRUCTURE/03_bibliotheque/modele_boutique.csv',
)
const targetDir = path.join(root, 'public/catalogue')
const targetCsv = path.join(targetDir, 'modele_boutique.csv')
const targetXls = path.join(targetDir, 'modele_boutique.xls')

fs.mkdirSync(targetDir, { recursive: true })

if (fs.existsSync(xlsSource)) {
  const wb = XLSX.read(fs.readFileSync(xlsSource), { type: 'buffer' })
  const sheetName =
    wb.SheetNames.find((n) => /catalogue|boutique|modele/i.test(n)) ||
    wb.SheetNames[0]
  const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName] || {})
  fs.writeFileSync(targetCsv, '\uFEFF' + csv.replace(/^\uFEFF/, ''), 'utf8')
  fs.copyFileSync(xlsSource, targetXls)
  console.log(
    '[sync:catalogue]',
    path.relative(root, xlsSource),
    '→',
    path.relative(root, targetXls),
    '+',
    path.relative(root, targetCsv),
  )
} else if (fs.existsSync(csvSource)) {
  const raw = fs.readFileSync(csvSource)
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
  fs.writeFileSync(targetCsv, text, 'utf8')
  console.log(
    '[sync:catalogue]',
    path.relative(root, csvSource),
    '→',
    path.relative(root, targetCsv),
    '(UTF-8)',
  )
} else {
  console.error(
    '[sync:catalogue] ERREUR : source introuvable',
    xlsSource,
    'ou',
    csvSource,
  )
  process.exit(1)
}

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
