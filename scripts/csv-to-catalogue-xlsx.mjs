/**
 * Convertit public/catalogue/matrice_catalogue.csv → .xlsx
 * Usage : node scripts/csv-to-catalogue-xlsx.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const csvPath = path.join(root, 'public/catalogue/matrice_catalogue.csv')
const xlsxPath = path.join(root, 'public/catalogue/matrice_catalogue.xlsx')

if (!fs.existsSync(csvPath)) {
  console.error('CSV introuvable:', csvPath)
  process.exit(1)
}

const text = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '')
const wb = XLSX.read(text, { type: 'string', raw: false })
// Feuille unique nommée catalogue
const sheetName = wb.SheetNames[0]
const sheet = wb.Sheets[sheetName]
const out = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(out, sheet, 'catalogue')
XLSX.writeFile(out, xlsxPath)
console.log('[csv→xlsx]', path.relative(root, xlsxPath))
