/**
 * Export devis client : capture 3D, HTML résumé, mailto.
 *
 * Note email : un navigateur ne peut PAS envoyer un mail depuis contact@philae.design
 * avec pièce jointe. Il faut un backend (Resend, SendGrid, Cloudflare Worker, etc.).
 * Ici : téléchargements + mailto texte vers contact@philae.design.
 */

const MAIL_TO = 'contact@philae.design'

/** Capture le canvas Three.js (vue courante ≈ vue par défaut). */
export function captureViewportScreenshot() {
  try {
    const canvas = document.querySelector('.viewport-3d canvas')
    if (!canvas) return null
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

export function downloadBlob(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function euro(n) {
  return `${Number(n).toFixed(2)} €`
}

function linesHtml(pricing) {
  if (!pricing?.lines?.length) return ''
  return pricing.lines
    .map((u) => {
      const dims = u.dims
      const modRows = (u.modules || [])
        .map(
          (m) =>
            `<tr><td>${m.label}</td><td>1</td><td>${euro(m.total)}</td><td>${euro(m.total)}</td></tr>`,
        )
        .join('')
      const panRows = (u.panneaux || [])
        .map(
          (p) =>
            `<tr><td>${p.label} (${p.surfaceM2.toFixed(3)} m²)</td><td>1</td><td>${euro(p.total)}</td><td>${euro(p.total)}</td></tr>`,
        )
        .join('')
      return `
      <section class="meuble">
        <h2>${escapeHtml(u.label)}</h2>
        <p class="dims">
          L ${dims.L} × P ${dims.W} × H ${dims.H} mm
          · essence ${escapeHtml(u.woodFinish || '')}
          · finition ${escapeHtml(u.ossatureFinish || '')}
        </p>
        <table>
          <thead>
            <tr><th>Élément</th><th>Qté</th><th>P.U. HT</th><th>Total HT</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Ossature (forfait + ${u.ossature.longueurM.toFixed(2)} m)</td>
              <td>1</td>
              <td>${euro(u.ossature.total)}</td>
              <td>${euro(u.ossature.total)}</td>
            </tr>
            ${panRows}
            ${modRows}
          </tbody>
        </table>
        <p class="subtotal">Sous-total meuble HT : <strong>${euro(u.ht)}</strong></p>
      </section>`
    })
    .join('')
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Document HTML autonome imprimable / à joindre au mail. */
export function buildDevisHtml({
  quoteRef,
  contact = {},
  notes = '',
  pricing,
  screenshotDataUrl = null,
  epaisseurPanneau,
  epaisseurPorte,
}) {
  const client = [contact.firstName, contact.lastName].filter(Boolean).join(' ')
  const photo = screenshotDataUrl
    ? `<figure><img src="${screenshotDataUrl}" alt="Vue configurateur" /><figcaption>Vue par défaut</figcaption></figure>`
    : '<p class="muted">Photo non disponible</p>'

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Devis Philae ${escapeHtml(quoteRef)}</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #1a140c; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.4rem; letter-spacing: 0.04em; }
    h2 { font-size: 1.1rem; margin-top: 1.5rem; border-bottom: 1px solid #c9a227; padding-bottom: 0.25rem; }
    .gold { color: #a67c22; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin: 0.75rem 0; }
    th, td { text-align: left; padding: 0.4rem 0.35rem; border-bottom: 1px solid #e8e0d0; }
    th { color: #666; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; }
    .totals { margin-top: 1.5rem; background: #f7f3ea; padding: 1rem; border-radius: 6px; }
    .totals div { display: flex; justify-content: space-between; margin: 0.25rem 0; }
    .ttc strong { font-size: 1.15rem; }
    figure { margin: 1rem 0; }
    figure img { max-width: 100%; border: 1px solid #ddd; border-radius: 4px; background: #0a0a0a; }
    figcaption { font-size: 0.75rem; color: #888; margin-top: 0.35rem; }
    .muted { color: #888; font-size: 0.85rem; }
    .legal { font-size: 0.75rem; color: #777; margin-top: 2rem; }
  </style>
</head>
<body>
  <header>
    <p class="gold">PHILAE DESIGN</p>
    <h1>Devis indicatif — réf. ${escapeHtml(quoteRef)}</h1>
    <p class="muted">${new Date().toLocaleString('fr-FR')}</p>
    ${client ? `<p>Client : <strong>${escapeHtml(client)}</strong>${contact.email ? ` · ${escapeHtml(contact.email)}` : ''}</p>` : ''}
    ${contact.phone ? `<p>Tél. ${escapeHtml(contact.phone)}</p>` : ''}
    <p class="muted">Épaisseurs : panneau ${epaisseurPanneau} mm · porte ${epaisseurPorte} mm</p>
  </header>

  ${photo}

  ${linesHtml(pricing)}

  <div class="totals">
    <div><span>Total HT</span><strong>${euro(pricing.ht)}</strong></div>
    <div><span>TVA 20 %</span><strong>${euro(pricing.tva)}</strong></div>
    <div class="ttc"><span>Total TTC indicatif</span><strong>${euro(pricing.ttc)}</strong></div>
  </div>

  ${notes ? `<p><strong>Notes</strong><br/>${escapeHtml(notes)}</p>` : ''}

  <p class="legal">
    Document généré par le configurateur Philae. Prix indicatifs — validation atelier requise.
    Contact : ${MAIL_TO}
  </p>
</body>
</html>`
}

/** Ouvre le client mail de l’utilisateur vers contact@philae.design (texte seul). */
export function openMailtoDevis({
  quoteRef,
  contact = {},
  notes = '',
  pricing,
  subjectPrefix = 'Demande de devis',
  extraLines = [],
}) {
  const client = [contact.firstName, contact.lastName].filter(Boolean).join(' ')
  const unitSummary = (pricing.lines || [])
    .map((u) => {
      const d = u.dims
      return `• ${u.label}: ${d.L}×${d.W}×${d.H} mm — ${u.ht.toFixed(2)} € HT`
    })
    .join('\n')

  const body = [
    `Référence : ${quoteRef}`,
    client ? `Client : ${client}` : null,
    contact.email ? `Email client : ${contact.email}` : null,
    contact.phone ? `Tél. : ${contact.phone}` : null,
    '',
    'Configuration :',
    unitSummary || '(vide)',
    '',
    `Total HT : ${pricing.ht.toFixed(2)} €`,
    `TVA : ${pricing.tva.toFixed(2)} €`,
    `Total TTC : ${pricing.ttc.toFixed(2)} €`,
    '',
    ...extraLines,
    notes ? `Notes : ${notes}` : null,
    '',
    '— Joindre les fichiers téléchargés (HTML, JSON, PNG) —',
    'Envoyé depuis le configurateur philae.design',
  ]
    .filter((l) => l != null)
    .join('\n')

  const subject = `${subjectPrefix} Philae ${quoteRef}`
  const href = `mailto:${MAIL_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  // Longueur max URL ~2000–8000 selon client ; tronquer le body si besoin
  const max = 1800
  const finalHref =
    href.length > max
      ? `mailto:${MAIL_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
          body.slice(0, 1200) +
            '\n\n[…] Résumé tronqué — voir fichiers HTML/JSON téléchargés.',
        )}`
      : href

  window.location.href = finalHref
}
