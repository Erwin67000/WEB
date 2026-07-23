/** Schéma client / contact — lié au master_input (colonne clientId). */
export const CLIENT_FIELDS = [
  { key: 'clientId', label: 'Réf. client', type: 'text' },
  { key: 'firstName', label: 'Prénom', type: 'text' },
  { key: 'lastName', label: 'Nom', type: 'text' },
  { key: 'email', label: 'E-mail', type: 'email' },
  { key: 'phone', label: 'Téléphone', type: 'tel' },
  { key: 'addressLine1', label: 'Adresse', type: 'text' },
  { key: 'addressLine2', label: 'Complément', type: 'text' },
  { key: 'postalCode', label: 'Code postal', type: 'text' },
  { key: 'city', label: 'Ville', type: 'text' },
  { key: 'country', label: 'Pays', type: 'text' },
]

/**
 * Identifiant client stable pour le CSV (réf. manuelle ou e-mail/nom).
 * @param {Record<string, string>} contact
 */
export function resolveClientId(contact = {}) {
  if (contact.clientId?.trim()) return contact.clientId.trim()
  const parts = [contact.email, contact.lastName, contact.firstName].filter(
    Boolean,
  )
  return parts.join('|') || ''
}
