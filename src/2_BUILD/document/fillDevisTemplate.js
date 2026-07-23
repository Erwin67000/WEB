/**
 * Publipostage devis.docx → document Word rempli (téléchargement).
 *
 * Template : src/2_BUILD/document/devis.docx
 * Servi en dev/prod via /document/devis.docx (copie public/) ou import URL.
 *
 * Syntaxe des balises dans Word : {quote_ref}  {client_nom}  …
 * Boucles : {#meubles} … {label} … {/meubles}
 *
 * PDF : conversion Word→PDF nécessite un service (LibreOffice / CloudConvert).
 * Pour l’instant on livre le .docx rempli ; PDF = étape suivante.
 */

import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { buildMergeData } from './mergeFields.js'

/** URL du template (copié dans public/document/ par le script de sync). */
export const DEVIS_TEMPLATE_URL = '/document/devis.docx'

let _templateCache = null

/**
 * Charge le binaire du template (cache session).
 */
export async function loadDevisTemplate(force = false) {
  if (_templateCache && !force) return _templateCache
  const res = await fetch(DEVIS_TEMPLATE_URL)
  if (!res.ok) {
    throw new Error(
      `Template devis introuvable (${res.status}). Placez devis.docx dans public/document/ ou src/2_BUILD/document/ puis relancez le sync.`,
    )
  }
  _templateCache = await res.arrayBuffer()
  return _templateCache
}

/**
 * Remplit le template avec les données matrice + pricing.
 * @returns {Blob} application/vnd.openxmlformats-officedocument.wordprocessingml.document
 */
export async function fillDevisDocx(state, pricing) {
  const data = buildMergeData(state, pricing)
  const content = await loadDevisTemplate()
  const zip = new PizZip(content)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    // nullGetter : balise inconnue → vide (pas d’erreur bloquante)
    nullGetter: () => '',
  })
  doc.render(data)
  const out = doc.getZip().generate({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  })
  return { blob: out, data }
}

/** Télécharge le blob .docx */
export function downloadBlobFile(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

/**
 * Génère et télécharge le devis Word rempli.
 * @returns {{ data: object, filename: string }}
 */
export async function downloadFilledDevis(state, pricing) {
  const { blob, data } = await fillDevisDocx(state, pricing)
  const filename = `Philae_Devis_${data.quote_ref || 'sans-ref'}.docx`
  downloadBlobFile(blob, filename)
  return { data, filename }
}
