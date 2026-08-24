/**
 * Vignette boutique / page produit : GLB figé + orbit/zoom.
 * — Max N Canvas WebGL (limite navigateur)
 * — Snapshot PNG quand le slot est libéré → pas d’écran vide au scroll retour
 * — Pas de ContactShadows (bande à mi-hauteur)
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF, Center, Bounds } from '@react-three/drei'
import * as THREE from 'three'
import { useI18n } from '@texte/I18nProvider.jsx'

const MAX_LIVE_CANVASES = 10
const liveSlots = new Set()
/** @type {{ id: string, resolve: (v: boolean) => void, cancelled: boolean }[]} */
const waitQueue = []

function acquireSlot(id) {
  return new Promise((resolve) => {
    if (liveSlots.has(id)) {
      resolve(true)
      return
    }
    if (liveSlots.size < MAX_LIVE_CANVASES) {
      liveSlots.add(id)
      resolve(true)
      return
    }
    const entry = { id, resolve, cancelled: false }
    waitQueue.push(entry)
  })
}

function releaseSlot(id) {
  liveSlots.delete(id)
  // Purge cancelled waiters
  while (waitQueue.length && waitQueue[0].cancelled) waitQueue.shift()
  const next = waitQueue.shift()
  if (next && !next.cancelled) {
    liveSlots.add(next.id)
    next.resolve(true)
  }
}

function cancelWait(id) {
  for (const e of waitQueue) {
    if (e.id === id && !e.cancelled) {
      e.cancelled = true
      e.resolve(false)
    }
  }
}

/** Snapshots par productId (persiste entre unmount canvas) */
const snapshotCache = new Map()

export function catalogGlbUrl(productId) {
  if (!productId) return null
  return `/catalogue/glb/${productId}.glb`
}

export function preloadCatalogGlbs(ids = []) {
  for (const id of ids) {
    const url = catalogGlbUrl(id)
    if (url) {
      try {
        useGLTF.preload(url)
      } catch {
        /* ignore */
      }
    }
  }
}

function GlbModel({ url }) {
  const { scene } = useGLTF(url)
  const clone = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false
        o.receiveShadow = false
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) {
          if (!m) continue
          // Solides un peu « en arrière » dans le Z-buffer ; tubes filaires
          // déjà exportés avec polygonOffset négatif
          const isEdge =
            typeof o.name === 'string' &&
            (o.name.includes('wire') || o.name.includes('-wire'))
          if (isEdge) {
            m.polygonOffset = true
            m.polygonOffsetFactor = -2
            m.polygonOffsetUnits = -2
            m.depthWrite = false
            o.renderOrder = 2
          } else {
            m.polygonOffset = true
            m.polygonOffsetFactor = 2
            m.polygonOffsetUnits = 2
            o.renderOrder = 0
          }
          m.needsUpdate = true
        }
      }
      if (o.isLineSegments || o.isLine) {
        o.frustumCulled = false
        o.renderOrder = 2
      }
    })
    return c
  }, [scene])
  return (
    <group position={[0, 0.02, 0]}>
      <primitive object={clone} />
    </group>
  )
}

/** Capture une frame une fois le modèle chargé */
function SnapshotCapture({ productId, onShot }) {
  const { gl, scene, camera } = useThree()
  const done = useRef(false)
  useEffect(() => {
    if (done.current || !productId) return
    const t = setTimeout(() => {
      try {
        gl.render(scene, camera)
        const data = gl.domElement.toDataURL('image/jpeg', 0.82)
        if (data && data.length > 100) {
          snapshotCache.set(productId, data)
          onShot?.(data)
        }
        done.current = true
      } catch {
        /* ignore */
      }
    }, 280)
    return () => clearTimeout(t)
  }, [gl, scene, camera, productId, onShot])
  return null
}

/**
 * Scène GLB + orbit libre.
 * Bounds fit une seule fois (pas observe) : observe recadrait en boucle
 * et bloquait la rotation tout en laissant le zoom.
 */
function Scene({ url, productId, onShot, freeOrbit = false }) {
  return (
    <>
      <color attach="background" args={['#f5f0e6']} />
      <ambientLight intensity={0.62} />
      <hemisphereLight args={['#e8f0ff', '#3a3020', 0.5]} />
      <directionalLight position={[3.5, 5, 2.5]} intensity={1.4} color="#fff5e6" />
      <directionalLight position={[-2, 2.5, -3]} intensity={0.4} />

      <Bounds fit clip={false} observe={false} margin={1.35}>
        <Center>
          <GlbModel url={url} />
        </Center>
      </Bounds>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        enableRotate
        enableZoom
        rotateSpeed={0.85}
        zoomSpeed={0.9}
        /* page produit : tour libre ; vignette boutique : un peu plus cadré */
        minPolarAngle={freeOrbit ? 0.12 : 0.2}
        maxPolarAngle={freeOrbit ? Math.PI * 0.92 : Math.PI * 0.72}
        minDistance={0.35}
        maxDistance={freeOrbit ? 16 : 12}
      />
      <SnapshotCapture productId={productId} onShot={onShot} />
    </>
  )
}

export default function CatalogGlbPreview({
  productId,
  height = 220,
  className = '',
  hint = true,
  eager = false,
  dpr = [1, 1.25],
  /** true = page produit (orbit large) ; false = vignette grille */
  freeOrbit = false,
  /** Monte le canvas seulement au hover / tap (grille boutique). */
  interactive = true,
  onCaptured,
}) {
  const { t } = useI18n()
  const rootRef = useRef(null)
  const slotId = useRef(`glb-${productId}`)
  const [inView, setInView] = useState(eager)
  const [hoverLive, setHoverLive] = useState(false)
  const [hasSlot, setHasSlot] = useState(false)
  const [failed, setFailed] = useState(false)
  const [snapshot, setSnapshot] = useState(
    () => snapshotCache.get(productId) || null,
  )
  const releaseTimer = useRef(null)

  const url = catalogGlbUrl(productId)
  const wantLive = interactive ? inView || hoverLive : eager || hoverLive

  useEffect(() => {
    setSnapshot(snapshotCache.get(productId) || null)
    setFailed(false)
    slotId.current = `glb-${productId}`
  }, [productId])

  // Visibilité (hystérésis large pour le scroll)
  useEffect(() => {
    if (eager) {
      setInView(true)
      return
    }
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '200px 0px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [eager, productId])

  // Slots WebGL : debounced release quand on sort de l’écran
  useEffect(() => {
    let cancelled = false

    if (releaseTimer.current) {
      clearTimeout(releaseTimer.current)
      releaseTimer.current = null
    }

    if (!wantLive || !url) {
      // Délai avant libération → scroll rapide ne démonte pas tout de suite
      releaseTimer.current = setTimeout(() => {
        cancelWait(slotId.current)
        releaseSlot(slotId.current)
        setHasSlot(false)
      }, 450)
      return () => {
        if (releaseTimer.current) clearTimeout(releaseTimer.current)
      }
    }

    acquireSlot(slotId.current).then((ok) => {
      if (cancelled || !ok) return
      setHasSlot(true)
    })

    return () => {
      cancelled = true
      cancelWait(slotId.current)
      // Ne pas release immédiatement au cleanup strict de React 18 double-mount
      // sauf si vraiment hors vue — géré par le timer quand inView false
    }
  }, [wantLive, url, productId])

  // Cleanup final unmount
  useEffect(() => {
    const id = slotId.current
    return () => {
      cancelWait(id)
      releaseSlot(id)
    }
  }, [productId])

  const showLive = wantLive && hasSlot && url && !failed

  return (
    <div
      ref={rootRef}
      className={`mini-3d ${className}${!snapshot && !showLive ? ' is-skeleton' : ''}`}
      style={{ height, background: '#f5f0e6', position: 'relative' }}
      onClick={(e) => {
        e.stopPropagation()
        if (!interactive && !eager) setHoverLive((v) => !v)
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerEnter={() => {
        if (!eager && !interactive) setHoverLive(true)
      }}
      onPointerLeave={() => {
        if (!eager && !interactive) setHoverLive(false)
      }}
    >
      {/* Snapshot sous le canvas : visible si pas de live / pendant reload */}
      {snapshot && !showLive && (
        <img
          src={snapshot}
          alt=""
          className="mini-3d-snapshot"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
          }}
        />
      )}

      {showLive && (
        <Canvas
          key={productId}
          dpr={dpr}
          camera={{ position: [-1.6, 1.1, -2], fov: 38, near: 0.01, far: 80 }}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            powerPreference: 'high-performance',
            alpha: false,
            preserveDrawingBuffer: true,
          }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault()
              setFailed(true)
              setHasSlot(false)
              releaseSlot(slotId.current)
            })
          }}
        >
          <Suspense fallback={null}>
            <Scene
              url={url}
              productId={productId}
              freeOrbit={freeOrbit}
              onShot={(data) => {
                setSnapshot(data)
                snapshotCache.set(productId, data)
                onCaptured?.(productId, data)
              }}
            />
          </Suspense>
        </Canvas>
      )}

      {!showLive && !snapshot && (
        <div className="mini-3d-skeleton" aria-hidden>
          <span />
        </div>
      )}
      {hint && eager && (
        <span className="mini-3d-hint">
          {freeOrbit ? t('config.dragZoom') : t('config.orbitZoom')}
        </span>
      )}
    </div>
  )
}
