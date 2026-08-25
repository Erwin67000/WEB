/**
 * E-mails PHILAE (Resend). Sans clé : log console, pas d’envoi.
 */

export async function sendMail(env, { to, subject, text, html }) {
  const dest = String(to || '').trim()
  if (!dest || !dest.includes('@')) return { sent: false, reason: 'no-to' }

  if (!env.RESEND_API_KEY) {
    console.log('[mail:dev]', dest, subject, '\n', text)
    return { sent: false, reason: 'no-resend', preview: true }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'PHILAE <noreply@philae.design>',
      to: [dest],
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('[mail]', res.status, err.slice(0, 300))
    return { sent: false, reason: `http-${res.status}` }
  }
  return { sent: true }
}

export function orderConfirmationCopy(order, lang = 'fr') {
  const en = String(lang).startsWith('en')
  const euros = ((Number(order.amount_charged_cents) || 0) / 100).toFixed(2)
  const label = order.product_label || order.quote_ref || order.id
  const subject = en
    ? `PHILAE — order confirmed ${order.id}`
    : `PHILAE — commande confirmée ${order.id}`
  const text = en
    ? `Hello,\n\nYour payment is confirmed.\n\nPiece: ${label}\nAmount: ${euros} € incl. VAT\nReference: ${order.id}\n\nProduction: 6 to 8 weeks from this confirmation.\n\nThank you.\n— Atelier Philae\ncontact@philae.design`
    : `Bonjour,\n\nVotre paiement est confirmé.\n\nMeuble : ${label}\nMontant : ${euros} € TTC\nRéférence : ${order.id}\n\nFabrication : 6 à 8 semaines à compter de cette confirmation.\n\nMerci.\n— Atelier Philae\ncontact@philae.design`
  return { subject, text }
}

export function accountCopy(user, lang = 'fr') {
  const en = String(lang).startsWith('en')
  const subject = en ? 'Your PHILAE account' : 'Votre compte PHILAE'
  const text = en
    ? `Hello${user.name ? ` ${user.name}` : ''},\n\nYour PHILAE account is ready (${user.email}).\nYou can sign in again with Google, Apple or an e-mail link.\n\nhttps://www.philae.design/compte\n\n— Atelier Philae`
    : `Bonjour${user.name ? ` ${user.name}` : ''},\n\nVotre compte PHILAE est créé (${user.email}).\nVous pourrez vous reconnecter via Google, Apple ou un lien e-mail.\n\nhttps://www.philae.design/compte\n\n— Atelier Philae`
  return { subject, text }
}
