import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import OssatureView from '../1_STRUCTURE/01_meuble3D/OssatureView.jsx'
import {
  ModulesMesh,
  PanneauxMesh,
} from '../1_STRUCTURE/02_agencement/ModuleMesh.jsx'
import {
  EPAISSEUR_PANNEAU,
  EPAISSEUR_PORTE,
  BOIS_ATELIER_ID,
  resolveOssatureFinish,
} from '../1_STRUCTURE/00_matrice/matrice_constante.js'
import { ConfigStoreProvider } from '../store/ConfigStoreContext.jsx'
import { createConfigStore } from '../store/createConfigStore.js'

const SCALE = 0.001

/** Store figé pour le rendu panneau (épaisseurs / flags) hors session interactive. */
const previewStoreCache = new Map()

function getPreviewStore() {
  const key = 'preview-static'
  if (!previewStoreCache.has(key)) {
    const store = createConfigStore({ name: 'preview' })
    store.setState({
      showPanneauRectangles: false,
      showPanneauRectFaces: false,
      showPanneauSolid: true,
      epaisseurPanneau: Number(EPAISSEUR_PANNEAU),
      epaisseurPorte: Number(EPAISSEUR_PORTE),
      wireframe: false,
    })
    previewStoreCache.set(key, store)
  }
  return previewStoreCache.get(key)
}

/**
 * Unité meuble figée (catalogue) — pas de sélection / axes.
 */
function FrozenUnit({ unit }) {
  const dims = unit.dims
  return (
    <group>
      <OssatureView
        dims={dims}
        woodFinish={unit.woodFinish || BOIS_ATELIER_ID}
        ossatureFinish={unit.ossatureFinish || 'brut'}
        wireframe={false}
        rotationZ={(unit.rotationZ || 0) * (Math.PI / 180)}
        selected={false}
      />
      <group rotation={[0, (unit.rotationZ || 0) * (Math.PI / 180), 0]}>
        <group scale={[SCALE, SCALE, SCALE]}>
          <group position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <PanneauxMesh
              dims={dims}
              panneaux={unit.panneaux || []}
              woodFinish={unit.woodFinish}
            />
          </group>
        </group>
        <group position={[0, 0, 0]}>
          <ModulesMesh
            dims={dims}
            modules={unit.modules || []}
            woodFinish={unit.woodFinish}
          />
        </group>
      </group>
    </group>
  )
}

function PreviewScene({ unit, autoRotate = false }) {
  const maxDim = Math.max(unit.dims.L, unit.dims.W, unit.dims.H) * SCALE
  // Origine fixe au coin (0,0,0) → viser le centre du volume
  const target = [
    (unit.dims.L * SCALE) / 2,
    (unit.dims.H * SCALE) / 2,
    -(unit.dims.W * SCALE) / 2,
  ]

  return (
    <>
      <color attach="background" args={['#141210']} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#e8f0ff', '#3a3020', 0.45]} />
      <directionalLight
        position={[3.5, 5, 2.5]}
        intensity={1.4}
        color="#fff5e6"
      />
      <directionalLight position={[-2, 2, -3]} intensity={0.35} />

      <FrozenUnit unit={unit} />

      <ContactShadows
        position={[0, 0.001, 0]}
        opacity={0.4}
        scale={Math.max(4, maxDim * 6)}
        blur={2.2}
        far={3}
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={maxDim * 1.2}
        maxDistance={maxDim * 8}
        maxPolarAngle={Math.PI * 0.49}
        target={target}
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
      />
    </>
  )
}

/**
 * Construit une unité meuble depuis une ligne matrice_catalogue.
 * Accepte modules/panneaux déjà normalisés (array) ou specs string CSV.
 */
export function unitFromCatalogRow(row) {
  if (!row) return null
  let modules = row.modules
  if (!Array.isArray(modules)) {
    // lazy parse if raw string slipped through
    modules = []
  }
  let panneaux = row.panneaux
  if (!Array.isArray(panneaux)) panneaux = []

  return {
    id: row.id,
    label: row.name,
    dims: { L: row.L_mm, W: row.W_mm, H: row.H_mm },
    woodFinish: BOIS_ATELIER_ID,
    ossatureFinish: resolveOssatureFinish(
      row.ossature_finish || row.texture || row.wood_finish,
    ),
    modules: modules.map((m, i) => ({
      id: m.id || `preview-${row.id}-${i}`,
      kind: m.kind,
      bayIndex: m.bayIndex ?? i,
      openFactor: m.openFactor ?? 0,
    })),
    panneaux: [...panneaux],
    positionMm: { x: 0, y: 0, z: 0 },
    rotationZ: 0,
  }
}

/**
 * Mini / grand viewer 3D figé — orbit + zoom uniquement.
 *
 * @param {{
 *   unit?: object,
 *   catalogRow?: object,
 *   height?: number | string,
 *   className?: string,
 *   hint?: boolean,
 *   autoRotate?: boolean,
 *   cameraDistance?: number,
 * }} props
 */
export default function FurniturePreview3D({
  unit: unitProp,
  catalogRow,
  height = 220,
  className = '',
  hint = true,
  autoRotate = false,
  dpr = [1, 1.25],
  /** Si true, monte le canvas dès le premier rendu (page article). */
  eager = false,
}) {
  const rootRef = useRef(null)
  const [visible, setVisible] = useState(eager)

  useEffect(() => {
    if (eager || visible) return
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '120px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [eager, visible])

  const unit = useMemo(
    () => unitProp || unitFromCatalogRow(catalogRow),
    [unitProp, catalogRow],
  )

  // Vue par défaut tournée 180° autour de l’axe vertical (face avant)
  const cameraPos = useMemo(() => {
    if (!unit) return [-1.8, 1.2, -2.2]
    const m = Math.max(unit.dims.L, unit.dims.W, unit.dims.H) * SCALE
    const d = Math.max(1.4, m * 3.2)
    return [-d * 0.85, d * 0.55, -d]
  }, [unit])

  if (!unit) {
    return (
      <div className={`mini-3d ${className}`} style={{ height }}>
        <span className="mini-3d-hint">—</span>
      </div>
    )
  }

  const previewStore = getPreviewStore()

  return (
    <div
      ref={rootRef}
      className={`mini-3d ${className}`}
      style={{ height }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {visible ? (
        <ConfigStoreProvider store={previewStore}>
          <Canvas
            dpr={dpr}
            camera={{
              position: cameraPos,
              fov: 40,
              near: 0.01,
              far: 80,
            }}
            gl={{
              antialias: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              powerPreference: 'high-performance',
              alpha: false,
            }}
          >
            <Suspense fallback={null}>
              <PreviewScene unit={unit} autoRotate={autoRotate} />
            </Suspense>
          </Canvas>
        </ConfigStoreProvider>
      ) : (
        <div className="mini-3d-placeholder" aria-hidden />
      )}
      {hint && <span className="mini-3d-hint">Orbit · zoom</span>}
    </div>
  )
}
