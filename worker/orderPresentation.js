/**
 * Libellés affichés sur Stripe Checkout, à partir de la config client.
 */

const PANNEAU = {
  fond: { fr: 'fond', en: 'back' },
  porte: { fr: 'porte', en: 'door' },
  dessous: { fr: 'dessous', en: 'base' },
  joue1: { fr: 'joue 1', en: 'side 1' },
  joue2: { fr: 'joue 2', en: 'side 2' },
  dessus_interieur: { fr: 'dessus intérieur', en: 'inner top' },
  dessus_exterieur: { fr: 'dessus', en: 'top' },
}

const FINISH = {
  brut: { fr: 'brut', en: 'unfinished' },
  vernis_clair: { fr: 'vernis', en: 'varnished' },
  vernis_fonce: { fr: 'vernis foncé', en: 'dark varnish' },
  huile: { fr: 'huile', en: 'oiled' },
  chene: { fr: 'chêne', en: 'oak' },
}

function isEn(lang) {
  return String(lang || '')
    .toLowerCase()
    .startsWith('en')
}

function clip(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1).trim()}…`
}

function dimsLabel(dims) {
  if (!dims) return ''
  const L = Math.round(Number(dims.L) || 0)
  const W = Math.round(Number(dims.W ?? dims.P) || 0)
  const H = Math.round(Number(dims.H) || 0)
  if (!L || !W || !H) return ''
  return `${L}×${W}×${H} mm`
}

function finishLabel(id, lang) {
  const key = String(id || '')
    .toLowerCase()
    .trim()
  const row = FINISH[key]
  if (row) return isEn(lang) ? row.en : row.fr
  return key.replace(/_/g, ' ')
}

function panneauLabel(id, lang) {
  const key = String(id || '')
    .toLowerCase()
    .trim()
  const row = PANNEAU[key]
  if (row) return isEn(lang) ? row.en : row.fr
  return key.replace(/_/g, ' ')
}

function moduleSummary(modules = [], lang) {
  const en = isEn(lang)
  const list = Array.isArray(modules) ? modules : []
  const shelves = list.filter((m) => m?.kind === 'shelf').length
  const drawers = list.filter((m) => m?.kind === 'drawer')
  const parts = []
  if (shelves === 1) parts.push(en ? '1 shelf' : '1 tablette')
  else if (shelves > 1) parts.push(en ? `${shelves} shelves` : `${shelves} tablettes`)
  if (drawers.length === 1) {
    const h = drawers[0]?.hMm
    parts.push(
      h
        ? en
          ? `1 drawer ${Math.round(h)} mm`
          : `1 tiroir ${Math.round(h)} mm`
        : en
          ? '1 drawer'
          : '1 tiroir',
    )
  } else if (drawers.length > 1) {
    parts.push(en ? `${drawers.length} drawers` : `${drawers.length} tiroirs`)
  }
  return parts.join(en ? ', ' : ', ')
}

function summarizeUnit(unit, lang) {
  const en = isEn(lang)
  const name = unit?.label || unit?.name || (en ? 'Philae piece' : 'Meuble PHILAE')
  const dims = dimsLabel(unit?.dims || unit)
  const finish = finishLabel(
    unit?.ossatureFinish || unit?.ossature_finish || unit?.texture,
    lang,
  )
  const modules = moduleSummary(unit?.modules, lang)
  const panneaux = (unit?.panneaux || [])
    .map((p) => panneauLabel(p, lang))
    .filter(Boolean)
  const bits = [dims, finish && (en ? `frame ${finish}` : `ossature ${finish}`), modules]
  if (panneaux.length) {
    bits.push(
      en ? `panels: ${panneaux.join(', ')}` : `panneaux : ${panneaux.join(', ')}`,
    )
  }
  return {
    name: dims ? `${name} · ${dims}` : name,
    detail: bits.filter(Boolean).join(' · '),
  }
}

function fromCatalog(catalog, lang) {
  if (!catalog) return null
  return summarizeUnit(
    {
      label: catalog.name || catalog.id,
      dims: catalog.dims || {
        L: catalog.L_mm,
        W: catalog.W_mm,
        H: catalog.H_mm,
      },
      ossatureFinish: catalog.ossature_finish || catalog.texture,
      modules: catalog.modules,
      panneaux: catalog.panneaux,
    },
    lang,
  )
}

function fromUnits(units, lang) {
  const list = Array.isArray(units) ? units.filter(Boolean) : []
  if (!list.length) return null
  const first = summarizeUnit(list[0], lang)
  if (list.length === 1) return first
  const extra = isEn(lang)
    ? `+ ${list.length - 1} other piece(s)`
    : `+ ${list.length - 1} autre(s) meuble(s)`
  return {
    name: `${first.name} ${extra}`,
    detail: [first.detail, extra].filter(Boolean).join(' · '),
  }
}

/**
 * @param {object} body payload /api/checkout
 * @param {string} quoteRef
 * @param {string} origin SITE_URL
 */
export function presentOrder(body = {}, quoteRef, origin) {
  const lang = body.lang || body.locale || 'fr'
  const en = isEn(lang)
  const config = body.config || {}
  const summary =
    fromCatalog(config.catalog, lang) ||
    fromUnits(config.units, lang) || {
      name: body.productLabel || (en ? 'Philae furniture' : 'Meuble PHILAE'),
      detail: '',
    }

  const kit = en
    ? 'Solid-wood kit, assembled without glue, screws or nails.'
    : 'Kit bois massif, assemblage sans colle, vis ni clous.'
  const lead = en
    ? 'Made to order, 6–8 weeks.'
    : 'Fabrication à la commande, 6 à 8 semaines.'
  const france = config.ecoParticipation === true || config.deliveryCountry === 'FR'
  const eco = france
    ? en
      ? 'French eco-contribution included (delivery in France).'
      : 'Éco-participation française incluse (livraison en France).'
    : en
      ? 'No French eco-contribution (delivery outside France).'
      : 'Pas d’éco-participation française (livraison hors France).'

  const withStop = (s) => {
    const t = String(s || '').trim()
    if (!t) return ''
    return /[.!?]$/.test(t) ? t : `${t}.`
  }
  const description = clip(
    [withStop(kit), withStop(summary.detail), withStop(lead), quoteRef ? `Réf. ${quoteRef}` : '']
      .filter(Boolean)
      .join(' '),
    500,
  )

  const httpsOrigin = /^https:\/\//i.test(String(origin || ''))
    ? String(origin).replace(/\/$/, '')
    : ''

  return {
    lang: en ? 'en' : 'fr',
    name: clip(summary.name, 120),
    description,
    submitMessage: clip(
      en
        ? 'Made-to-order Philae piece — production 6 to 8 weeks after payment.'
        : 'Meuble PHILAE fabriqué à la commande — délai 6 à 8 semaines après paiement.',
      200,
    ),
    shippingMessage: clip(
      en
        ? `Delivery to the building threshold. ${eco}`
        : `Livraison au seuil. ${eco}`,
      200,
    ),
    imageUrl: httpsOrigin ? `${httpsOrigin}/logo-philae.jpg` : '',
  }
}

export function isoCountry(code) {
  const s = String(code || '')
    .trim()
    .toUpperCase()
  if (s === 'FR' || s === 'FRA' || s === 'FRANCE') return 'FR'
  if (s === 'EU' || s === 'WORLD') return null
  if (/^[A-Z]{2}$/.test(s)) return s
  return null
}
