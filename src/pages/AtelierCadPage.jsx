import { useEffect, useMemo } from 'react'
import { useConfigStore } from '../store/useConfigStore.js'
import { snapshotFromState } from '../store/createConfigStore.js'
import { readLocalConfig, persistSavedConfig } from '../lib/savedConfig.js'
import {
  downloadFurnitureCad,
  collectUnitMeshes,
  bindPhilaeCadExport,
} from '../lib/furnitureExport.js'
import { formatMmAsCm } from '../3_INPUT/matrice_input.js'

export default function AtelierCadPage() {
  const units = useConfigStore((s) => s.units)
  const quoteRef = useConfigStore((s) => s.quoteRef)
  const hydrateFromSnapshot = useConfigStore((s) => s.hydrateFromSnapshot)

  useEffect(() => {
    const st = useConfigStore.getState()
    if (!st.units?.length || (!st.dirty && !st.configHydrated)) {
      const local = readLocalConfig()
      if (local?.units?.length) {
        hydrateFromSnapshot(local, { keepContact: true })
      }
    }
  }, [hydrateFromSnapshot])

  useEffect(() => {
    return bindPhilaeCadExport(() => useConfigStore.getState())
  }, [])

  const parts = useMemo(() => {
    const state = useConfigStore.getState()
    return (units || []).map((u) => ({
      id: u.id,
      label: u.label,
      dims: u.dims,
      n: collectUnitMeshes(u, state).length,
    }))
  }, [units])

  const download = () => {
    const state = useConfigStore.getState()
    persistSavedConfig(snapshotFromState(state))
    downloadFurnitureCad(state)
  }

  return (
    <div className="legal-page" style={{ maxWidth: '40rem', padding: '2.5rem 1.4rem 4rem' }}>
      <p className="muted" style={{ fontSize: '0.75rem', letterSpacing: '0.08em' }}>
        USAGE INTERNE · PHILAE
      </p>
      <h1 style={{ fontSize: '1.6rem', margin: '0.3rem 0 0.8rem' }}>
        Export DAE + CSV
      </h1>
      <p>
        Cette page n’est pas dans le menu. Elle exporte la configuration
        actuelle du configurateur (ossature, panneaux découpés, tablettes,
        traverses, tiroirs et façades).
      </p>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Réf. {quoteRef || '—'} · console : <code>philaeCad()</code>
      </p>
      <ul style={{ paddingLeft: '1.1rem' }}>
        {parts.map((p) => (
          <li key={p.id}>
            {p.label} — {formatMmAsCm(p.dims?.L)} × {formatMmAsCm(p.dims?.W)} ×{' '}
            {formatMmAsCm(p.dims?.H)} cm · {p.n} solides
          </li>
        ))}
      </ul>
      <button type="button" className="btn primary" onClick={download}>
        Télécharger DAE + CSV
      </button>
    </div>
  )
}
