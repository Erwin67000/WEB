/**
 * Génère le template Word de publipostage devis.docx
 * avec les balises {champ} prêtes pour docxtemplater.
 *
 * Usage : node scripts/build-devis-template.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HeadingLevel,
} from 'docx'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outSrc = path.join(root, 'src/2_BUILD/document/devis.docx')
const outPublic = path.join(root, 'public/document/devis.docx')

const thin = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: 'CCCCCC',
}
const borders = { top: thin, bottom: thin, left: thin, right: thin }
const noBorder = {
  style: BorderStyle.NONE,
  size: 0,
  color: 'FFFFFF',
}
const noBorders = {
  top: noBorder,
  bottom: noBorder,
  left: noBorder,
  right: noBorder,
}

function cell(text, opts = {}) {
  return new TableCell({
    borders: opts.borders ?? borders,
    width: { size: opts.w || 2340, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: opts.bold,
            size: opts.size || 18,
            font: 'Arial',
            color: opts.color || '1A140C',
          }),
        ],
      }),
    ],
  })
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: 'Arial', size: 20 },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: 'PHILAE DESIGN',
              bold: true,
              size: 28,
              color: 'A67C22',
              font: 'Arial',
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: 'Devis indicatif — configurateur',
              size: 32,
              bold: true,
              font: 'Arial',
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Référence : ', bold: true }),
            new TextRun('{quote_ref}'),
            new TextRun('    Date : '),
            new TextRun('{date_devis}'),
          ],
        }),
        new Paragraph({ spacing: { before: 300, after: 100 }, children: [
          new TextRun({ text: 'Client', bold: true, size: 24, color: 'A67C22' }),
        ]}),
        new Paragraph({
          children: [
            new TextRun('{client_fullname}'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('{client_adresse}'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('{client_cp} {client_ville}'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun('E-mail : '),
            new TextRun('{client_email}'),
            new TextRun('  ·  Tél. : '),
            new TextRun('{client_tel}'),
          ],
        }),

        new Paragraph({ spacing: { before: 300, after: 100 }, children: [
          new TextRun({ text: 'Configuration', bold: true, size: 24, color: 'A67C22' }),
        ]}),
        new Paragraph({
          children: [
            new TextRun({ text: 'Meuble : ', bold: true }),
            new TextRun('{meuble_label}'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Dimensions : ', bold: true }),
            new TextRun('{meuble_dims}'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Finition ossature : ', bold: true }),
            new TextRun('{meuble_finition}'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Panneaux : ', bold: true }),
            new TextRun('{meuble_panneaux}'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Aménagements : ', bold: true }),
            new TextRun('{meuble_modules}'),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({ text: 'Épaisseurs : ', bold: true }),
            new TextRun('panneau {epaisseur_panneau} mm · porte {epaisseur_porte} mm'),
          ],
        }),

        new Paragraph({ spacing: { before: 300, after: 100 }, children: [
          new TextRun({ text: 'Détail des lignes', bold: true, size: 24, color: 'A67C22' }),
        ]}),

        // En-tête tableau
        new Table({
          width: { size: 10466, type: WidthType.DXA },
          columnWidths: [3200, 2200, 1000, 2000, 2066],
          rows: [
            new TableRow({
              children: [
                cell('Désignation', { bold: true, w: 3200 }),
                cell('Détail', { bold: true, w: 2200 }),
                cell('Qté', { bold: true, w: 1000 }),
                cell('P.U. HT', { bold: true, w: 2000 }),
                cell('Total HT', { bold: true, w: 2066 }),
              ],
            }),
            // Lignes générées par boucle docxtemplater
            new TableRow({
              children: [
                cell('{#lignes}{designation}', { w: 3200 }),
                cell('{detail}', { w: 2200 }),
                cell('{qte}', { w: 1000 }),
                cell('{pu}', { w: 2000 }),
                cell('{total}{/lignes}', { w: 2066 }),
              ],
            }),
          ],
        }),

        new Paragraph({ spacing: { before: 300 }, children: [] }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: 'Total HT : ', bold: true }),
            new TextRun('{prix_ht} €'),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: 'TVA 20 % : ', bold: true }),
            new TextRun('{prix_tva} €'),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({ text: 'Total TTC : ', bold: true, size: 24 }),
            new TextRun({ text: '{prix_ttc} €', bold: true, size: 24 }),
          ],
        }),

        new Paragraph({ spacing: { before: 300 }, children: [
          new TextRun({ text: 'Notes', bold: true, size: 22, color: 'A67C22' }),
        ]}),
        new Paragraph({
          children: [new TextRun('{notes}')],
        }),

        new Paragraph({ spacing: { before: 400 }, children: [
          new TextRun({
            text: 'Document généré par le configurateur Philae. Prix indicatifs — validation atelier requise. contact@philae.design',
            size: 16,
            color: '666666',
            italics: true,
          }),
        ]}),

        new Paragraph({ spacing: { before: 200 }, children: [
          new TextRun({
            text: 'Astuce : ouvrez ce fichier dans Word pour déplacer / ajouter des balises {champ}. Voir README_PUBLIPOSTAGE.md',
            size: 14,
            color: '999999',
          }),
        ]}),
      ],
    },
  ],
})

const buffer = await Packer.toBuffer(doc)
fs.mkdirSync(path.dirname(outSrc), { recursive: true })
fs.mkdirSync(path.dirname(outPublic), { recursive: true })
fs.writeFileSync(outSrc, buffer)
fs.writeFileSync(outPublic, buffer)
console.log('[build-devis-template]', path.relative(root, outSrc), buffer.length, 'bytes')
console.log('[build-devis-template]', path.relative(root, outPublic), buffer.length, 'bytes')
