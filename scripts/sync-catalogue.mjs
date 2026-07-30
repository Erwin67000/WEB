/**
 * Source unique du catalogue boutique :
 *   public/catalogue/matrice_catalogue.xlsx
 *
 * Si le monorepo expose un xlsx/csv plus récent, on l’importe ici.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const monoDir = path.resolve(
  root,
  '../../01_structure/08_bibliotheque/models/boutique',
)
const targetXlsx = path.join(root, 'public/catalogue/matrice_catalogue.xlsx')
const targetCsv = path.join(root, 'public/catalogue/matrice_catalogue.csv')

const candidates = [
  path.join(monoDir, 'matrice_catalogue.xlsx'),
  path.join(monoDir, 'matrice_catalogue.xls'),
  path.join(monoDir, 'matrice_catalogue.csv'),
]

const legacy = path.join(
  root,
  'public/structure/08_bibliotheque/models/boutique/matrice_catalogue.csv',
)

function pickMono() {
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

const mono = pickMono()
if (mono) {
  const ext = path.extname(mono).toLowerCase()
  const dest =
    ext === '.csv'
      ? targetCsv
      : path.join(root, 'public/catalogue', `matrice_catalogue${ext === '.xls' ? '.xls' : '.xlsx'}`)
  const monoStat = fs.statSync(mono)
  const destExists = fs.existsSync(dest)
  const destStat = destExists ? fs.statSync(dest) : null
  if (!destExists || monoStat.mtimeMs > (destStat?.mtimeMs || 0)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, fs.readFileSync(mono))
    console.log('[sync:catalogue] import monorepo →', path.relative(root, dest))
  } else {
    console.log('[sync:catalogue] public/catalogue à jour')
  }
} else {
  console.log(
    '[sync:catalogue] monorepo absent — source locale public/catalogue/',
  )
}

if (fs.existsSync(legacy)) {
  try {
    fs.unlinkSync(legacy)
    console.log('[sync:catalogue] supprimé doublon', path.relative(root, legacy))
  } catch {
    /* ignore */
  }
}

const hasExcel =
  fs.existsSync(targetXlsx) ||
  fs.existsSync(path.join(root, 'public/catalogue/matrice_catalogue.xls'))
const hasCsv = fs.existsSync(targetCsv)

if (!hasExcel && !hasCsv) {
  console.error(
    '[sync:catalogue] ERREUR : aucun catalogue (xlsx/xls/csv) dans public/catalogue/',
  )
  process.exit(1)
}

console.log(
  '[sync:catalogue] source :',
  hasExcel
    ? 'public/catalogue/matrice_catalogue.xlsx'
    : 'public/catalogue/matrice_catalogue.csv (legacy)',
)
