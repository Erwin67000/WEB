/**
 * Source unique des modèles préconfigurés :
 *   src/1_STRUCTURE/03_bibliotheque/modele_boutique.csv  (CSV UTF-8)
 *
 * Copie vers public/catalogue/modele_boutique.csv pour le navigateur.
 * Si le .csv atelier est encore un Excel binaire (OLE), il est reconverti
 * en vrai CSV UTF-8 (éditable dans VS Code + Rainbow CSV).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const xlsxSource = path.join(
  root,
  'src/1_STRUCTURE/03_bibliotheque/modele_boutique.xlsx',
)
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
const targetXlsx = path.join(targetDir, 'modele_boutique.xlsx')

const csvSidecar = path.join(
  root,
  'src/1_STRUCTURE/03_bibliotheque/modele_boutique.utf8.csv',
)

fs.mkdirSync(targetDir, { recursive: true })

function isOleOrZip(buf) {
  if (!buf || buf.length < 4) return false
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11) return true
  if (buf[0] === 0x50 && buf[1] === 0x4b) return true
  return false
}

function sheetToUtf8Csv(sheet) {
  return '\uFEFF' + XLSX.utils.sheet_to_csv(sheet).replace(/^\uFEFF/, '')
}

function workbookFromCsvText(text) {
  return XLSX.read(String(text).replace(/^\uFEFF/, ''), { type: 'string' })
}

function writePublicCsv(text, label) {
  const csv = '\uFEFF' + String(text).replace(/^\uFEFF/, '')
  fs.writeFileSync(targetCsv, csv, 'utf8')
  const wb = workbookFromCsvText(csv)
  const out = XLSX.utils.book_new()
  const sheetName = wb.SheetNames[0] || 'modele_boutique'
  XLSX.utils.book_append_sheet(out, wb.Sheets[sheetName], 'modele_boutique')
  XLSX.writeFile(out, targetXlsx)
  if (fs.existsSync(targetXls)) {
    try {
      fs.unlinkSync(targetXls)
    } catch {
      /* ignore */
    }
  }
  console.log(
    '[sync:catalogue]',
    label,
    '→',
    path.relative(root, targetCsv),
    '(UTF-8)',
  )
}

function tryWriteAtelierCsv(text) {
  try {
    fs.writeFileSync(csvSource, text, 'utf8')
    if (fs.existsSync(csvSidecar)) {
      try {
        fs.unlinkSync(csvSidecar)
      } catch {
        /* ignore */
      }
    }
    return true
  } catch (e) {
    fs.writeFileSync(csvSidecar, text, 'utf8')
    console.warn(
      '[sync:catalogue] ' +
        path.relative(root, csvSource) +
        ' est verrouillé (' +
        (e.code || e.message) +
        ').',
    )
    console.warn(
      '[sync:catalogue] Ferme l’onglet VS Code / Excel sur ce fichier, puis relance `npm run boutique`.',
    )
    console.warn(
      '[sync:catalogue] Copie UTF-8 temporaire :',
      path.relative(root, csvSidecar),
    )
    return false
  }
}

function csvTextFromBuffer(raw, label) {
  if (isOleOrZip(raw)) {
    const wb = XLSX.read(raw, { type: 'buffer' })
    const sheetName =
      wb.SheetNames.find((n) => /catalogue|boutique|modele/i.test(n)) ||
      wb.SheetNames[0]
    const sheet = wb.Sheets[sheetName] || {}
    console.log('[sync:catalogue]', label, 'était un Excel binaire → CSV UTF-8')
    return sheetToUtf8Csv(sheet)
  }
  let text = raw.toString('utf8')
  const looksBroken =
    text.includes('\uFFFD') ||
    (/Biblioth.|entr.|Etag.|Si.ge|Ext.rieur/.test(text) &&
      !/Bibliothèque|entrée|Etagère|Siège|Extérieur/.test(text))
  if (looksBroken) {
    text = raw.toString('latin1')
    console.log('[sync:catalogue] reconversion Latin-1 → UTF-8')
  }
  return '\uFEFF' + text.replace(/^\uFEFF/, '')
}

let csvText = null
let csvLabel = null
let sourceWasBinary = false

if (fs.existsSync(csvSource)) {
  const raw = fs.readFileSync(csvSource)
  sourceWasBinary = isOleOrZip(raw)
  if (sourceWasBinary && fs.existsSync(csvSidecar)) {
    csvText = csvTextFromBuffer(fs.readFileSync(csvSidecar), path.relative(root, csvSidecar))
    csvLabel = path.relative(root, csvSidecar)
  } else {
    csvText = csvTextFromBuffer(raw, path.relative(root, csvSource))
    csvLabel = path.relative(root, csvSource)
  }
} else if (fs.existsSync(csvSidecar)) {
  csvText = csvTextFromBuffer(fs.readFileSync(csvSidecar), path.relative(root, csvSidecar))
  csvLabel = path.relative(root, csvSidecar)
} else if (fs.existsSync(xlsxSource) || fs.existsSync(xlsSource)) {
  const excelSource = fs.existsSync(xlsxSource) ? xlsxSource : xlsSource
  csvText = csvTextFromBuffer(fs.readFileSync(excelSource), path.relative(root, excelSource))
  csvLabel = path.relative(root, excelSource)
} else {
  console.error('[sync:catalogue] ERREUR : source introuvable', csvSource)
  process.exit(1)
}

writePublicCsv(csvText, csvLabel)
if (sourceWasBinary || !fs.existsSync(csvSource)) {
  tryWriteAtelierCsv(csvText)
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
