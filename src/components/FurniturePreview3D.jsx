/**
 * Preview 3D :
 * — Boutique / page produit : GLB figé du catalogue (CatalogGlbPreview)
 * — Fallback rare : pipeline calculé (si pas de productId / pas de GLB)
 *
 * Le configurateur complet reste dans 3Dconfigurateur.jsx
 * (ouvert seulement via « Configurer »).
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
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
import CatalogGlbPreview, {
  catalogGlbUrl,
} from './CatalogGlbPreview.jsx'

const SCALE = 0.001

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

function FrozenUnit({ unit }) {
  const dims = unit.dims
  const groupRef = useRef()
  const t0 = useRef(performance.now())

  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    const t = Math.min(1, (performance.now() - t0.current) / 480)
    const e = 1 - (1 - t) ** 3
    g.scale.setScalar(0.9 + 0.1 * e)
    g.position.y = (1 - e) * 0.04
  })

  return (
    <group ref={groupRef}>
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
        minDistance={maxDim * 1.05}
        maxDistance={maxDim * 7}
        maxPolarAngle={Math.PI * 0.49}
        target={target}
        autoRotate={autoRotate}
        autoRotateSpeed={0.45}
      />
    </>
  )
}

export function unitFromCatalogRow(row) {
  if (!row) return null
  let modules = row.modules
  if (!Array.isArray(modules)) modules = []
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
 * @param {{
 *   unit?: object,
 *   catalogRow?: object,
 *   productId?: string,
 *   height?: number|string,
 *   className?: string,
 *   hint?: boolean,
 *   autoRotate?: boolean,
 *   eager?: boolean,
 *   dpr?: number|[number,number],
 *   forceLive?: boolean,
 * }} props
 */
export default function FurniturePreview3D({
  unit: unitProp,
  catalogRow,
  productId: productIdProp,
  height = 220,
  className = '',
  hint = true,
  autoRotate = false,
  dpr = [1, 1.25],
  eager = false,
  /** Force le pipeline calculé (debug) */
  forceLive = false,
}) {
  const productId = productIdProp || catalogRow?.id || unitProp?.id
  const glbUrl = productId ? catalogGlbUrl(productId) : null

  // Préférence : GLB catalogue (pas de recalcul)
  if (glbUrl && !forceLive && !autoRotate) {
    return (
      <CatalogGlbPreview
        productId={productId}
        height={height}
        className={className}
        hint={hint}
        eager={eager}
        dpr={dpr}
      />
    )
  }

  // Fallback calculé (session custom / debug)
  return (
    <LiveGeometryPreview
      unitProp={unitProp}
      catalogRow={catalogRow}
      height={height}
      className={className}
      hint={hint}
      autoRotate={autoRotate}
      dpr={dpr}
      eager={eager}
    />
  )
}

function LiveGeometryPreview({
  unitProp,
  catalogRow,
  height,
  className,
  hint,
  autoRotate,
  dpr,
  eager,
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

  const cameraPos = useMemo(() => {
    if (!unit) return [-1.35, 0.95, -1.7]
    const { L, W, H } = unit.dims
    const halfDiag = Math.sqrt(L * L + W * W + H * H) * SCALE * 0.5
    const d = Math.max(0.95, halfDiag * 2.55)
    return [-d * 0.82, d * 0.52, -d * 0.95]
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
              fov: 38,
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
