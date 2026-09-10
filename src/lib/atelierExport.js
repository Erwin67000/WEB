/**
 * CSV atelier Philae — géométrie résolue pour partenaires
 * (usinage panneaux, tiroirs Würth, pose).
 *
 * Une ligne = un objet. Filtrer la colonne `ligne` :
 *   meta | meuble | tablette | tiroir | panneau | porte | case
 *
 * Millimètres. Cellule vide = non.
 * Schéma : philae-atelier-v1
 */
import {
  moduleLayout,
  faceGroupsForUnit,
  faceGroupBuildParams,
  porteGroupsForUnit,
  porteGroupBuildParams,
  porteXSplit,
  panelBaysFromModules,
  doorBaysFromModules,
  resolveFaceBays,
  resolvePorteBays,
  buildPanneauComplet,
  SEGMENTED_FACES,
} from '../1_STRUCTURE/02_agencement/agencement.js'
import {
  EPAISSEUR_PANNEAU,
  EPAISSEUR_PORTE,
  resolveAreteSection,
  PANNEAU_LABELS,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'

export const ATELIER_SCHEMA = 'philae-atelier-v1'

export const ATELIER_COLUMNS = [
  'ligne',
  'schema',
  'quoteRef',
  'date',
  'meuble_index',
  'meuble_id',
  'label',
  'catalog_id',
  'L_mm',
  'P_mm',
  'H_mm',
  'arete_mm',
  'epaisseur_panneau_mm',
  'epaisseur_porte_mm',
  'couleur_ossature',
  'couleur_panneau',
  'couleur_porte',
  'panneaux',
  'piece_id',
  'piece_index',
  'face',
  'couverture',
  'charniere',
  'battant',
  'case_from',
  'case_to',
  'z_bas_mm',
  'z_haut_mm',
  'h_mm',
  'L_utile_mm',
  'P_utile_mm',
  'epaisseur_mm',
  'usinage_L_mm',
  'usinage_H_mm',
  'usinage_ep_mm',
  'wurth_type',
  'wurth_h_mm',
  'lwk_mm',
  'lic_mm',
  'profondeur_mm',
  'decroche_mm',
  'rail_lat_mm',
  'alerte',
  'notes',
]

function csvCell(v) {
  if (v == null || v === '') return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function mm(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return ''
  const r = Math.round(v * 10) / 10
  return Object.is(r, -0) ? 0 : r
}

function aabb(points) {
  if (!points?.length) return null
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of points) {
    const x = Number(p[0])
    const y = Number(p[1])
    const z = Number(p[2])
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
    if (z < minZ) minZ = z
    if (z > maxZ) maxZ = z
  }
  const dx = maxX - minX
  const dy = maxY - minY
  const dz = maxZ - minZ
  const sorted = [dx, dy, dz].sort((a, b) => b - a)
  return {
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    dx,
    dy,
    dz,
    usinageL: sorted[0],
    usinageH: sorted[1],
    usinageEp: sorted[2],
  }
}

function usinageFromAabb(box) {
  if (!box) return { usinage_L_mm: '', usinage_H_mm: '', usinage_ep_mm: '' }
  return {
    usinage_L_mm: mm(box.usinageL),
    usinage_H_mm: mm(box.usinageH),
    usinage_ep_mm: mm(box.usinageEp),
  }
}

function couvertureOf(group, bayCount) {
  if (!group) return 'plein'
  const n = Number(bayCount) || 0
  if (n <= 1) return 'plein'
  if (group.isBottom && group.isTop) return 'plein'
  if (group.firstIndex === 0 && group.lastIndex === n - 1) return 'plein'
  return 'intermediaire'
}

function panneauPoints(nom, dims, params) {
  try {
    const { panneau } = buildPanneauComplet(nom, dims, params)
    return panneau?.points || null
  } catch {
    return null
  }
}

function emptyRow() {
  return Object.fromEntries(ATELIER_COLUMNS.map((h) => [h, '']))
}

function row(patch) {
  return { ...emptyRow(), ...patch }
}

/**
 * Lignes atelier depuis l’état configurateur (store ou snapshot localStorage).
 */
export function buildAtelierRows(state) {
  const quoteRef = state.quoteRef || ''
  const date = new Date().toISOString()
  const catalogId = state.catalogProductId || ''
  const epP = Number(state.epaisseurPanneau ?? EPAISSEUR_PANNEAU)
  const epD = Number(state.epaisseurPorte ?? EPAISSEUR_PORTE)
  const rows = []

  rows.push(
    row({
      ligne: 'meta',
      schema: ATELIER_SCHEMA,
      quoteRef,
      date,
      notes:
        'Géométrie résolue (mm). Filtrer `ligne`. DAE = maillage SketchUp Z-up. Pas de fichier public.',
    }),
  )

  ;(state.units || []).forEach((unit, ui) => {
    const dims = unit.dims || {}
    const L = Number(dims.L) || 0
    const P = Number(dims.W ?? dims.P) || 0
    const H = Number(dims.H) || 0
    const modules = unit.modules || []
    const arete = resolveAreteSection({ L, W: P, H })
    const couleurPan = unit.panneauCouleur || 'olive'
    const couleurPorte = unit.porteCouleur || couleurPan
    const couleurOss = unit.ossatureFinish || 'brut'
    const panneaux = (unit.panneaux || []).join('|')
    const ctx = {
      quoteRef,
      date,
      meuble_index: ui,
      meuble_id: unit.id || `u${ui}`,
      label: unit.label || `Meuble ${ui + 1}`,
      catalog_id: catalogId,
      L_mm: mm(L),
      P_mm: mm(P),
      H_mm: mm(H),
      arete_mm: arete.label,
      epaisseur_panneau_mm: mm(epP),
      epaisseur_porte_mm: mm(epD),
      couleur_ossature: couleurOss,
      couleur_panneau: couleurPan,
      couleur_porte: couleurPorte,
      panneaux,
    }

    const shelves = modules.filter((m) => m.kind === 'shelf')
    const drawers = modules.filter((m) => m.kind === 'drawer')
    const tablettesZ = shelves
      .map((m) => {
        const layout = moduleLayout(m, dims, modules)
        return mm(layout.zTopMm ?? layout.zMm)
      })
      .filter((v) => v !== '')
    const tiroirsH = drawers.map((m) => {
      const layout = moduleLayout(m, dims, modules)
      return mm(layout.hMm)
    })

    rows.push(
      row({
        ...ctx,
        ligne: 'meuble',
        schema: ATELIER_SCHEMA,
        notes: [
          tablettesZ.length ? `tablettes_z=${tablettesZ.join('|')}` : '',
          tiroirsH.length ? `tiroirs_h=${tiroirsH.join('|')}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      }),
    )

    shelves.forEach((mod, i) => {
      const layout = moduleLayout(mod, dims, modules)
      const zHaut = layout.zTopMm ?? layout.zMm
      const zBas = Number(zHaut) - epP
      const Lutile = layout.size?.[0]
      const Putile = layout.size?.[1]
      rows.push(
        row({
          ...ctx,
          ligne: 'tablette',
          piece_id: `tablette-${i + 1}`,
          piece_index: i + 1,
          face: 'tablette',
          couverture: 'plein',
          z_bas_mm: mm(zBas),
          z_haut_mm: mm(zHaut),
          h_mm: mm(epP),
          L_utile_mm: mm(Lutile),
          P_utile_mm: mm(Putile),
          epaisseur_mm: mm(epP),
          usinage_L_mm: mm(Lutile),
          usinage_H_mm: mm(Putile),
          usinage_ep_mm: mm(epP),
          notes: 'Plateau octogone — L×P = rectangle englobant. z_haut = face sup.',
        }),
      )
    })

    drawers.forEach((mod, i) => {
      const layout = moduleLayout(mod, dims, modules)
      const wurth = layout.wurth || {}
      const zBas = layout.zBottomMm ?? layout.zMm
      const h = layout.hMm ?? wurth.hMm
      const zHaut = Number(zBas) + Number(h)
      const alerte = wurth.depthWarn || layout.depthTooSmall || layout.lwkOutOfRange
        ? wurth.depthWarn ||
          (layout.depthTooSmall ? 'profondeur insuffisante' : '') ||
          (layout.lwkOutOfRange ? 'LWK hors plage' : '')
        : ''
      rows.push(
        row({
          ...ctx,
          ligne: 'tiroir',
          piece_id: `tiroir-${i + 1}`,
          piece_index: i + 1,
          face: 'tiroir',
          couverture: 'plein',
          z_bas_mm: mm(zBas),
          z_haut_mm: mm(zHaut),
          h_mm: mm(h),
          L_utile_mm: mm(layout.licMm ?? wurth.licMm),
          P_utile_mm: mm(layout.depthMm ?? wurth.depthMm),
          epaisseur_mm: mm(epP),
          usinage_L_mm: mm(layout.licMm ?? wurth.licMm),
          usinage_H_mm: mm(layout.depthMm ?? wurth.depthMm),
          usinage_ep_mm: mm(h),
          wurth_type: wurth.type || 'B',
          wurth_h_mm: mm(wurth.hMm ?? h),
          lwk_mm: mm(layout.lwkMm ?? wurth.lwkMm),
          lic_mm: mm(layout.licMm ?? wurth.licMm),
          profondeur_mm: mm(layout.depthMm ?? wurth.depthMm),
          decroche_mm: mm(wurth.decrocheMm),
          rail_lat_mm: mm(wurth.railSideSpaceMm),
          alerte,
          notes: 'Würth ASTUCIO type B + Dynamoov. z_bas = dessus traverses / rails.',
        }),
      )
    })

    const selected = unit.panneaux || []
    for (const nom of selected) {
      if (nom === 'porte' || SEGMENTED_FACES.includes(nom)) continue
      const pts = panneauPoints(nom, dims, { epaisseur: epP })
      const box = aabb(pts)
      rows.push(
        row({
          ...ctx,
          ligne: 'panneau',
          piece_id: `panneau-${nom}`,
          piece_index: 1,
          face: nom,
          couverture: 'plein',
          z_bas_mm: mm(box?.minZ),
          z_haut_mm: mm(box?.maxZ),
          h_mm: mm(box?.dz),
          L_utile_mm: mm(box?.dx),
          P_utile_mm: mm(box?.dy),
          epaisseur_mm: mm(epP),
          ...usinageFromAabb(box),
          notes: PANNEAU_LABELS[nom] || nom,
        }),
      )
    }

    const panelBays = panelBaysFromModules(dims, modules)
    for (const nom of SEGMENTED_FACES) {
      const groups = faceGroupsForUnit(unit, nom)
      groups.forEach((g, gi) => {
        const params = faceGroupBuildParams(g, dims, modules, nom)
        const pts = panneauPoints(nom, dims, { epaisseur: epP, ...params })
        const box = aabb(pts)
        const cov = couvertureOf(g, panelBays.length)
        const typeNote = params.type ? ` · ${params.type}` : ''
        rows.push(
          row({
            ...ctx,
            ligne: 'panneau',
            piece_id: `panneau-${nom}-${g.key || gi}`,
            piece_index: gi + 1,
            face: nom,
            couverture: cov,
            case_from: g.firstIndex,
            case_to: g.lastIndex,
            z_bas_mm: mm(params.zMin ?? g.zMin ?? box?.minZ),
            z_haut_mm: mm(params.zMax ?? g.zMax ?? box?.maxZ),
            h_mm: mm(
              (params.zMax ?? g.zMax ?? box?.maxZ) -
                (params.zMin ?? g.zMin ?? box?.minZ),
            ),
            epaisseur_mm: mm(epP),
            ...usinageFromAabb(box),
            notes: `${PANNEAU_LABELS[nom] || nom} · ${cov}${typeNote}`,
          }),
        )
      })
    }

    const split = porteXSplit(dims)
    const doorBays = doorBaysFromModules(dims, modules)
    porteGroupsForUnit(unit).forEach((g, gi) => {
      const hinge = unit.porteHinge?.[g.key] || 'left'
      const cov = couvertureOf(g, doorBays.length)
      const leaves =
        hinge === 'center'
          ? [
              { tag: 'L', extra: { xMax: split.xMid } },
              { tag: 'R', extra: { xMin: split.xMid } },
            ]
          : [{ tag: 'unique', extra: {} }]
      leaves.forEach((leaf, li) => {
        const params = porteGroupBuildParams(g, dims, modules, {
          ...leaf.extra,
          coverShelfTop: true,
          forDoor: true,
        })
        const pts = panneauPoints('porte', dims, { epaisseur: epD, ...params })
        const box = aabb(pts)
        rows.push(
          row({
            ...ctx,
            ligne: 'porte',
            piece_id: `porte-${g.key || gi}-${leaf.tag}`,
            piece_index: gi + 1 + li / 10,
            face: 'porte',
            couverture: cov,
            charniere: hinge,
            battant: leaf.tag,
            case_from: g.firstIndex,
            case_to: g.lastIndex,
            z_bas_mm: mm(params.zMin ?? g.zMin ?? box?.minZ),
            z_haut_mm: mm(params.zMax ?? g.zMax ?? box?.maxZ),
            h_mm: mm(
              (params.zMax ?? g.zMax ?? box?.maxZ) -
                (params.zMin ?? g.zMin ?? box?.minZ),
            ),
            epaisseur_mm: mm(epD),
            couleur_porte: couleurPorte,
            ...usinageFromAabb(box),
            notes: `Porte ${cov} · charnière ${hinge} · battant ${leaf.tag}`,
          }),
        )
      })
    })

    panelBays.forEach((b) => {
      const occupied = []
      for (const nom of SEGMENTED_FACES) {
        const selectedBays = resolveFaceBays(unit, nom, panelBays)
        if (selectedBays.includes(b.index)) occupied.push(nom)
      }
      const selectedDoors = resolvePorteBays(unit, doorBays)
      const doorHit = doorBays.some(
        (db) =>
          selectedDoors.includes(db.index) &&
          db.zMin < b.zMax - 0.5 &&
          db.zMax > b.zMin + 0.5,
      )
      if (doorHit) occupied.push('porte')
      rows.push(
        row({
          ...ctx,
          ligne: 'case',
          piece_id: `case-${b.index}`,
          piece_index: b.index,
          face: b.kind || 'case',
          couverture: occupied.length ? 'occupe' : 'vide',
          case_from: b.index,
          case_to: b.index,
          z_bas_mm: mm(b.zMin),
          z_haut_mm: mm(b.zMax),
          h_mm: mm(b.zMax - b.zMin),
          notes: occupied.length
            ? `Occupée : ${occupied.join('|')}`
            : 'Case vide (pas de panneau sur cette bande)',
        }),
      )
    })
  })

  return rows
}

export function atelierRowsToCsv(rows) {
  const lines = [ATELIER_COLUMNS.join(',')]
  for (const r of rows) {
    lines.push(ATELIER_COLUMNS.map((h) => csvCell(r[h])).join(','))
  }
  return lines.join('\n')
}

export function buildAtelierCsv(state) {
  return atelierRowsToCsv(buildAtelierRows(state))
}
