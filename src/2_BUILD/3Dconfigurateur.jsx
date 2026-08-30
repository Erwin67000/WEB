import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  OrbitControls,
  Grid,
  ContactShadows,
  useGLTF,
  useTexture,
} from '@react-three/drei'
import * as THREE from 'three'
import OssatureView from '../1_STRUCTURE/01_meuble3D/OssatureView.jsx'
import AgencementView from '../1_STRUCTURE/02_agencement/ModuleMesh.jsx'
import FacePickPlanes from '../1_STRUCTURE/02_agencement/FacePickPlanes.jsx'
import { ENVIRONMENTS } from '../1_STRUCTURE/00_matrice/matrice_configuration.js'
import {
  useActiveConfigStore,
  useActiveConfigStoreApi,
} from '../store/ConfigStoreContext.jsx'
import { useI18n } from '@texte/I18nProvider.jsx'
import { bindSceneCapture } from '../lib/sceneCapture.js'
import {
  calibWorldBasis,
  ndcToPhotoUv,
  dirFrom,
  projectDeltaOnXY,
  containPlane,
  photoCamDistance,
  clampPhotoFov,
  PHOTO_FOV_DEFAULT,
  PHOTO_FOV_MIN,
  PHOTO_FOV_MAX,
} from '../lib/photoCalib.js'
import PhotoCalibOverlay from '../components/PhotoCalibOverlay.jsx'

const SCALE = 0.001

/**
 * Caméra par défaut : tournée de 180° autour de l’axe vertical (Y Three = Z meuble).
 * Avant [2.2, 1.6, 2.8] montrait l’arrière → on regarde depuis l’opposé.
 */
export const DEFAULT_CAMERA_POS = [-2.2, 1.6, -2.8]
export const DEFAULT_CAMERA_TARGET = [0.35, 0.45, -0.25]

/**
 * Apparition légère : scale + légère montée (meubel 1 ou meuble ajouté).
 * key=unit.id force un rejoue de l’anim à chaque nouvel id.
 */
function PhotoGhost({ active, children }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const root = ref.current
    if (!root || !active) return
    const backups = []
    root.traverse((obj) => {
      const mats = obj.material
      if (!mats) return
      const list = Array.isArray(mats) ? mats : [mats]
      list.forEach((m) => {
        backups.push({
          m,
          o: m.opacity,
          t: m.transparent,
          w: m.wireframe,
          dw: m.depthWrite,
        })
        m.transparent = true
        m.opacity =
          obj.isLine || obj.isLineSegments || obj.isLineSegments2 ? 0.9 : 0.16
        if ('wireframe' in m && obj.isMesh) m.wireframe = true
        m.depthWrite = false
        m.needsUpdate = true
      })
    })
    return () => {
      backups.forEach(({ m, o, t, w, dw }) => {
        m.opacity = o
        m.transparent = t
        if ('wireframe' in m) m.wireframe = w
        m.depthWrite = dw
      })
    }
  }, [active])
  return <group ref={ref}>{children}</group>
}

function UnitGroup({
  unit,
  selected,
  wireframe,
  pickMode,
  onPickFace,
  photoMode = false,
  ghost = false,
}) {
  const groupRef = useRef()
  const t0 = useRef(performance.now())

  useEffect(() => {
    t0.current = performance.now()
  }, [unit.id])

  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    if (photoMode) {
      // Sol Z = 0 figé : pas de lift, l’échelle vient du pose photo.
      g.scale.setScalar(1)
      g.position.y = 0
      return
    }
    const t = Math.min(1, (performance.now() - t0.current) / 520)
    // easeOutCubic
    const e = 1 - (1 - t) ** 3
    const s = 0.88 + 0.12 * e
    g.scale.setScalar(s)
    // petite montée (mm → m via pos déjà en m côté parent)
    const lift = (1 - e) * 0.06
    g.position.y =
      (unit.positionMm?.z || 0) * SCALE + lift
  })

  const pos = [
    (unit.positionMm?.x || 0) * SCALE,
    (unit.positionMm?.z || 0) * SCALE,
    -(unit.positionMm?.y || 0) * SCALE,
  ]
  const rotY = (unit.rotationZ || 0) * (Math.PI / 180)

  const body = (
    <>
      <OssatureView
        dims={unit.dims}
        woodFinish={unit.woodFinish}
        ossatureFinish={unit.ossatureFinish}
        wireframe={wireframe || ghost}
        rotationZ={rotY}
        selected={selected && !photoMode}
        showAxes={false}
      />
      <group rotation={[0, rotY, 0]}>
        <AgencementView
          dims={unit.dims}
          modules={unit.modules}
          panneaux={unit.panneaux}
          porteBays={unit.porteBays}
          porteOpen={unit.porteOpen}
          porteHinge={unit.porteHinge}
          fondBays={unit.fondBays}
          joue1Bays={unit.joue1Bays}
          joue2Bays={unit.joue2Bays}
          woodFinish={unit.woodFinish}
          ossatureFinish={unit.ossatureFinish}
          panneauCouleur={unit.panneauCouleur}
          panneauCouleurHex={unit.panneauCouleurHex}
        />
      </group>
      {pickMode && selected && (
        <group position={[0, 0, 0]}>
          <FacePickPlanes
            dims={unit.dims}
            panneaux={unit.panneaux || []}
            modules={unit.modules || []}
            unit={unit}
            rotationZ={rotY}
            onPick={onPickFace}
          />
        </group>
      )}
    </>
  )

  return (
    <group ref={groupRef} position={pos}>
      {ghost ? <PhotoGhost active>{body}</PhotoGhost> : body}
    </group>
  )
}

/**
 * Scène GLB (SketchUp → glTF).
 *
 * Convention Philae (une fois pour toutes) :
 * — Origine du GLB = origine du meuble 1 / configurateur (0,0,0)
 * — X : contre le mur (même sens que longueur meuble)
 * — Y SketchUp (mur → lit) : profondeur — en glTF Y-up, c’est souvent −Z Three
 * — Z SketchUp (haut) → Y Three (export glTF standard)
 *
 * Aucun recentrage auto : la géométrie doit être modélisée à l’origine SketchUp.
 * Ajustements fin via env.position / env.rotation / env.scale (mètres, radians).
 */
function GlbScene({ url, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }) {
  const { scene } = useGLTF(url)
  const root = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
      }
    })
    return clone
  }, [scene])

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={root} />
    </group>
  )
}

function SceneCaptureBinder() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    bindSceneCapture((mime) => {
      gl.render(scene, camera)
      const src = gl.domElement
      if (mime === 'image/jpeg') {
        const c = document.createElement('canvas')
        c.width = src.width
        c.height = src.height
        const ctx = c.getContext('2d')
        ctx.fillStyle = '#111111'
        ctx.fillRect(0, 0, c.width, c.height)
        ctx.drawImage(src, 0, 0)
        return c.toDataURL('image/jpeg', 0.92)
      }
      return src.toDataURL('image/png')
    })
    return () => bindSceneCapture(null)
  }, [gl, scene, camera])
  return null
}

/** Photo contain : proportions d’origine, bandes noires autour. */
function PhotoEnvironment({ url }) {
  const { size } = useThree()
  const texture = useTexture(url)
  const photoAspectStore = useActiveConfigStore((s) => s.photoCalib?.photoAspect)
  const setPhotoCalib = useActiveConfigStore((s) => s.setPhotoCalib)
  const viewAspect = size.width / Math.max(1, size.height)
  const img = texture.image
  const fromImg =
    img && img.width && img.height ? img.width / Math.max(1, img.height) : 0
  const photoAspect = fromImg || photoAspectStore || viewAspect
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
  }, [texture])
  useEffect(() => {
    if (!fromImg) return
    if (Math.abs(fromImg - (Number(photoAspectStore) || 0)) < 0.002) return
    setPhotoCalib({ photoAspect: fromImg })
  }, [fromImg, photoAspectStore, setPhotoCalib])
  const { w, h } = containPlane(viewAspect, photoAspect)
  return (
    <mesh position={[0, 0, -0.02]} renderOrder={-2} raycast={() => {}}>
      <planeGeometry key={`${w.toFixed(4)}x${h.toFixed(4)}`} args={[w, h]} />
      <meshBasicMaterial map={texture} depthWrite={false} />
    </mesh>
  )
}

/**
 * Caméra photo : fov photo (défaut 58°) + dolly pour garder le cliché en contain.
 * Le meuble a une vraie profondeur Z → fuyantes, plus une projection parallèle.
 */
function PhotoCameraLock() {
  const { camera, controls } = useThree()
  const zoom = useActiveConfigStore((s) => s.photoCalib?.zoom || 1)
  const fov = useActiveConfigStore(
    (s) => s.photoCalib?.fov ?? PHOTO_FOV_DEFAULT,
  )

  useLayoutEffect(() => {
    const prev = {
      pos: camera.position.toArray(),
      quat: camera.quaternion.toArray(),
      fov: camera.fov,
      target: controls?.target
        ? controls.target.toArray()
        : [...DEFAULT_CAMERA_TARGET],
    }
    camera.up.set(0, 1, 0)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    if (controls?.target) {
      controls.target.set(0, 0, 0)
      controls.update?.()
    }
    return () => {
      camera.position.set(prev.pos[0], prev.pos[1], prev.pos[2])
      camera.quaternion.set(
        prev.quat[0],
        prev.quat[1],
        prev.quat[2],
        prev.quat[3],
      )
      camera.fov = prev.fov
      camera.updateProjectionMatrix()
      if (controls?.target) {
        controls.target.set(prev.target[0], prev.target[1], prev.target[2])
        controls.update?.()
      }
    }
  }, [camera, controls])

  useLayoutEffect(() => {
    const f = Math.max(0.5, clampPhotoFov(fov))
    const z = photoCamDistance(zoom, f)
    camera.position.set(0, 0, z)
    camera.lookAt(0, 0, 0)
    camera.fov = f
    camera.updateProjectionMatrix()
  }, [camera, zoom, fov])

  return null
}

function PhotoPerspectiveControl() {
  const { t } = useI18n()
  const fov = useActiveConfigStore(
    (s) => s.photoCalib?.fov ?? PHOTO_FOV_DEFAULT,
  )
  const setPhotoCalib = useActiveConfigStore((s) => s.setPhotoCalib)
  const value = clampPhotoFov(fov)
  return (
    <div className="photo-fov-chip" onPointerDown={(e) => e.stopPropagation()}>
      <label>
        <span className="photo-fov-label">
          {t('config.photoPerspective')}
          <span className="photo-fov-val">{Math.round(value)}°</span>
        </span>
        <input
          type="range"
          min={PHOTO_FOV_MIN}
          max={PHOTO_FOV_MAX}
          step={1}
          value={value}
          aria-label={t('config.photoPerspective')}
          onChange={(e) => setPhotoCalib({ fov: Number(e.target.value) })}
        />
      </label>
      <button
        type="button"
        className="photo-fov-reset"
        onClick={() => setPhotoCalib({ fov: PHOTO_FOV_DEFAULT })}
        hidden={Math.abs(value - PHOTO_FOV_DEFAULT) < 0.5}
      >
        {t('config.photoPerspectiveReset')}
      </button>
    </div>
  )
}

function PhotoDoneHandle() {
  const step = useActiveConfigStore((s) => s.photoCalib?.step)
  const storeApi = useActiveConfigStoreApi()
  const { gl, camera, size } = useThree()
  const dragRef = useRef(null)

  useEffect(() => {
    if (step !== 'done') return undefined
    const el = gl.domElement
    const aspect = size.width / Math.max(1, size.height)

    const uvOf = (ev) => {
      const rect = el.getBoundingClientRect()
      const ndcX =
        ((ev.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
      const ndcY =
        -((ev.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
      const c = storeApi.getState().photoCalib || {}
      return ndcToPhotoUv(
        ndcX,
        ndcY,
        aspect,
        camera.position.z,
        c.photoAspect,
        c.fov,
      )
    }

    const onWheel = (ev) => {
      ev.preventDefault()
      const prev = Number(storeApi.getState().photoCalib?.zoom) || 1
      const next = Math.min(4, Math.max(0.4, prev * (ev.deltaY > 0 ? 0.92 : 1.08)))
      storeApi.getState().setPhotoCalib({ zoom: next })
    }

    const onDown = (ev) => {
      if (ev.button !== 2) return
      ev.preventDefault()
      ev.stopImmediatePropagation()
      const c = storeApi.getState().photoCalib || {}
      dragRef.current = {
        uv: uvOf(ev),
        su: Number(c.shiftU) || 0,
        sv: Number(c.shiftV) || 0,
      }
      el.setPointerCapture?.(ev.pointerId)
    }

    const onMove = (ev) => {
      if (!dragRef.current) return
      const c = storeApi.getState().photoCalib || {}
      const uv = uvOf(ev)
      const du = uv[0] - dragRef.current.uv[0]
      const dv = uv[1] - dragRef.current.uv[1]
      const origin = c.originUv
      const dirX = origin && c.xUv ? dirFrom(origin, c.xUv) : [1, 0]
      const yStart = c.y0Uv || origin
      const dirY = yStart && c.yUv ? dirFrom(yStart, c.yUv) : [0, 1]
      const [su, sv] = projectDeltaOnXY(du, dv, dirX, dirY)
      storeApi.getState().setPhotoCalib({
        shiftU: dragRef.current.su + su,
        shiftV: dragRef.current.sv + sv,
      })
    }

    const onUp = (ev) => {
      dragRef.current = null
      el.releasePointerCapture?.(ev.pointerId)
    }

    const onContext = (ev) => ev.preventDefault()

    el.addEventListener('wheel', onWheel, { passive: false, capture: true })
    el.addEventListener('pointerdown', onDown, true)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('contextmenu', onContext)
    return () => {
      el.removeEventListener('wheel', onWheel, true)
      el.removeEventListener('pointerdown', onDown, true)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('contextmenu', onContext)
    }
  }, [step, gl, camera, size.width, size.height, storeApi])

  return null
}

function PhotoFurnitureFrame({ children }) {
  const calib = useActiveConfigStore((s) => s.photoCalib)
  const { size } = useThree()
  const aspect = size.width / Math.max(1, size.height)
  const basis = useMemo(
    () => (calib ? calibWorldBasis(calib, aspect, size.height) : null),
    [calib, aspect, size.height],
  )
  const groupRef = useRef()
  useLayoutEffect(() => {
    const g = groupRef.current
    if (!g) return
    if (!basis) {
      g.visible = false
      return
    }
    g.visible = true
    const x = new THREE.Vector3(...basis.axisX)
    const y = new THREE.Vector3(...basis.axisY)
    const z = new THREE.Vector3(...basis.axisZ)
    if (x.lengthSq() < 1e-8) x.set(1, 0, 0)
    if (y.lengthSq() < 1e-8) y.set(0, 1, 0)
    if (z.lengthSq() < 1e-8) z.set(0, 0, 1)
    const m = new THREE.Matrix4()
    m.makeBasis(x, y, z)
    m.setPosition(basis.origin[0], basis.origin[1], 0)
    g.matrixAutoUpdate = false
    g.matrix.copy(m)
    g.matrixWorldNeedsUpdate = true
  }, [basis])
  return <group ref={groupRef}>{children}</group>
}

function EnvironmentScene({ env }) {
  if (!env || env.id === 'none' || !env.glb) return null
  return (
    <Suspense fallback={null}>
      <GlbScene
        url={env.glb}
        position={env.position || [0, 0, 0]}
        rotation={env.rotation || [0, 0, 0]}
        scale={env.scale ?? 1}
      />
    </Suspense>
  )
}

/** Sol invisible pour recevoir les ombres projetées (même sans pièce). */
function ShadowFloor() {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[20, 20]} />
      <shadowMaterial transparent opacity={0.28} />
    </mesh>
  )
}

function SunLight({ enabled, intensity }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (!ref.current || !enabled) return
    const t = clock.elapsedTime * 0.05
    ref.current.position.set(
      Math.cos(t) * 8,
      6 + Math.sin(t) * 1.5,
      Math.sin(t) * 8,
    )
    ref.current.target.position.set(0, 0.4, 0)
    ref.current.target.updateMatrixWorld()
  })
  if (!enabled) return null
  return (
    <directionalLight
      ref={ref}
      intensity={intensity}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.00025}
      shadow-normalBias={0.02}
      position={[5, 8, 4]}
      color="#fff5e6"
      shadow-camera-near={0.5}
      shadow-camera-far={30}
      shadow-camera-left={-6}
      shadow-camera-right={6}
      shadow-camera-top={6}
      shadow-camera-bottom={-6}
    />
  )
}

function SceneContent({ orbitOnly = false, ivory = false }) {
  const units = useActiveConfigStore((s) => s.units)
  const activeUnitId = useActiveConfigStore((s) => s.activeUnitId)
  const environmentId = useActiveConfigStore((s) => s.environmentId)
  const scenePhotoDataUrl = useActiveConfigStore((s) => s.scenePhotoDataUrl)
  const sceneSheetOpen = useActiveConfigStore((s) => s.sceneSheetOpen)
  const photoCalib = useActiveConfigStore((s) => s.photoCalib)
  const sunEnabled = useActiveConfigStore((s) => s.sunEnabled)
  const sunIntensity = useActiveConfigStore((s) => s.sunIntensity)
  const showGridStore = useActiveConfigStore((s) => s.showGrid)
  const wireframe = useActiveConfigStore((s) => s.wireframe)
  const panneauPickModeStore = useActiveConfigStore((s) => s.panneauPickMode)
  const togglePanneau = useActiveConfigStore((s) => s.togglePanneau)
  const togglePorteBay = useActiveConfigStore((s) => s.togglePorteBay)
  const toggleFaceBay = useActiveConfigStore((s) => s.toggleFaceBay)
  const panneauPickMode = orbitOnly ? false : panneauPickModeStore
  const envBase = orbitOnly
    ? ENVIRONMENTS.none
    : ENVIRONMENTS[environmentId] || ENVIRONMENTS.none
  const ivoryLook = Boolean(ivory)
  const env = ivoryLook
    ? { ...ENVIRONMENTS.none, bg: '#f5f0e6', grid: false }
    : envBase
  const photoMode =
    Boolean(scenePhotoDataUrl) &&
    Boolean(sceneSheetOpen) &&
    environmentId === 'none' &&
    !orbitOnly &&
    !ivoryLook
  const showGrid = orbitOnly || photoMode ? false : showGridStore

  const active = units.find((u) => u.id === activeUnitId) || units[0]
  // Cible orbit = centre du volume (origine meuble fixée au coin 0,0,0)
  const orbitTarget = active
    ? [
        ((active.positionMm?.x || 0) + active.dims.L / 2) * SCALE,
        ((active.positionMm?.z || 0) + active.dims.H / 2) * SCALE,
        -((active.positionMm?.y || 0) + active.dims.W / 2) * SCALE,
      ]
    : DEFAULT_CAMERA_TARGET

  const onPickFace = (faceId) => {
    if (typeof faceId !== 'string') return
    if (faceId.startsWith('porte-bay:')) {
      togglePorteBay(Number(faceId.slice('porte-bay:'.length)))
      return
    }
    const m = /^(fond|joue1|joue2)-bay:(\d+)$/.exec(faceId)
    if (m) {
      toggleFaceBay(m[1], Number(m[2]))
      return
    }
    togglePanneau(faceId)
  }

  return (
    <>
      <SceneCaptureBinder />
      <color attach="background" args={[photoMode ? '#111111' : env.bg || '#0a0a0a']} />
      {photoMode && (
        <Suspense fallback={null}>
          <PhotoEnvironment url={scenePhotoDataUrl} />
        </Suspense>
      )}
      <ambientLight intensity={ivoryLook ? 0.62 : sunEnabled ? 0.28 : 0.55} />
      <hemisphereLight
        args={[
          '#e8f0ff',
          '#3a3020',
          ivoryLook ? 0.5 : sunEnabled ? 0.35 : 0.45,
        ]}
      />
      <SunLight enabled={!ivoryLook && sunEnabled} intensity={sunIntensity} />
      {(ivoryLook || !sunEnabled) && (
        <directionalLight
          position={ivoryLook ? [3.5, 6, 2.5] : [-3, 5, -2]}
          intensity={ivoryLook ? 1.35 : 0.45}
          color="#fff5e6"
        />
      )}

      {showGrid && !env.room && !photoMode && (
        <Grid
          args={[20, 20]}
          cellSize={0.2}
          cellThickness={0.6}
          cellColor="#2a2a2a"
          sectionSize={1}
          sectionThickness={1}
          sectionColor="#3d3d20"
          fadeDistance={18}
          fadeStrength={1.2}
          infiniteGrid
          position={[0, 0.001, 0]}
        />
      )}

      {!photoMode && <EnvironmentScene env={env} />}
      {sunEnabled && !ivoryLook && !photoMode && <ShadowFloor />}

      {photoMode && <PhotoCameraLock />}
      {photoMode && photoCalib?.step === 'done' && <PhotoDoneHandle />}

      {photoMode ? (
        <PhotoFurnitureFrame>
          {units.map((u) => (
            <UnitGroup
              key={u.id}
              unit={u}
              selected={u.id === activeUnitId}
              wireframe={wireframe}
              pickMode={false}
              onPickFace={onPickFace}
              photoMode
              ghost={photoCalib?.step && photoCalib.step !== 'done'}
            />
          ))}
        </PhotoFurnitureFrame>
      ) : (
        <group>
          {units.map((u) => (
            <UnitGroup
              key={u.id}
              unit={u}
              selected={u.id === activeUnitId}
              wireframe={wireframe}
              pickMode={panneauPickMode}
              onPickFace={onPickFace}
              photoMode={false}
            />
          ))}
        </group>
      )}

      {!photoMode && (
        <ContactShadows
          position={[0, 0.001, 0]}
          opacity={sunEnabled ? 0.22 : 0.35}
          scale={12}
          blur={2.5}
          far={4}
        />
      )}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan={!orbitOnly && !photoMode}
        enableRotate={!photoMode}
        enableZoom={!photoMode}
        minDistance={0.5}
        maxDistance={20}
        /* Mode ajout panneau : on peut passer sous z=0 pour cliquer le socle.
           Sinon z=0 infranchissable (polar max ≈ horizon). */
        maxPolarAngle={
          photoMode
            ? Math.PI * 0.49
            : panneauPickMode
              ? Math.PI * 0.98
              : Math.PI * 0.49
        }
        minPolarAngle={0}
        target={orbitTarget}
        enabled={!photoMode}
      />
      <CameraFloorClamp pickMode={panneauPickMode} />
    </>
  )
}

/**
 * En quittant le mode pick : si la caméra est sous l’horizon, on la relève
 * pour rétablir z=0 infranchissable.
 */
function CameraFloorClamp({ pickMode }) {
  const { camera, controls } = useThree()
  const prevPick = useRef(pickMode)

  useEffect(() => {
    if (prevPick.current && !pickMode) {
      // Sortie du mode pick : clamp polar ≤ horizon
      const target = controls?.target || new THREE.Vector3(0, 0.4, 0)
      const offset = camera.position.clone().sub(target)
      const spherical = new THREE.Spherical().setFromVector3(offset)
      const maxPhi = Math.PI * 0.49
      if (spherical.phi > maxPhi) {
        spherical.phi = maxPhi
        offset.setFromSpherical(spherical)
        camera.position.copy(target).add(offset)
        camera.lookAt(target)
        if (controls) {
          controls.update?.()
        }
      }
    }
    prevPick.current = pickMode
  }, [pickMode, camera, controls])

  return null
}

function ViewportHint({ pickMode, photoMode }) {
  const { t } = useI18n()
  const photoStep = useActiveConfigStore((s) => s.photoCalib?.step)
  const touch =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(pointer: coarse)').matches
  if (photoMode && photoStep === 'done') {
    return <div className="viewport-hint">{t('config.hintPhotoDone')}</div>
  }
  if (photoMode) return null
  return (
    <div className="viewport-hint">
      {pickMode
        ? t('config.hintPick')
        : touch
          ? t('config.hintTouch')
          : t('config.hintOrbit')}
    </div>
  )
}

export default function Configurateur3D({ orbitOnly = false, ivory = false }) {
  const panneauPickModeStore = useActiveConfigStore((s) => s.panneauPickMode)
  const panneauPickMode = orbitOnly ? false : panneauPickModeStore
  const scenePhotoDataUrl = useActiveConfigStore((s) => s.scenePhotoDataUrl)
  const sceneSheetOpen = useActiveConfigStore((s) => s.sceneSheetOpen)
  const environmentId = useActiveConfigStore((s) => s.environmentId)
  const photoMode =
    Boolean(scenePhotoDataUrl) &&
    Boolean(sceneSheetOpen) &&
    environmentId === 'none' &&
    !orbitOnly &&
    !ivory

  return (
    <div
      className={`viewport-3d${panneauPickMode ? ' pick-mode' : ''}${
        ivory ? ' is-ivory' : ''
      }${orbitOnly ? ' is-orbit-only' : ''}`}
    >
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{
          position: DEFAULT_CAMERA_POS,
          fov: 45,
          near: 0.01,
          far: 100,
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true,
        }}
        onCreated={({ gl, camera }) => {
          gl.shadowMap.enabled = true
          gl.shadowMap.type = THREE.PCFSoftShadowMap
          camera.lookAt(...DEFAULT_CAMERA_TARGET)
        }}
      >
        <Suspense fallback={null}>
          <SceneContent orbitOnly={orbitOnly} ivory={ivory} />
        </Suspense>
      </Canvas>
      {!orbitOnly && (
        <ViewportHint pickMode={panneauPickMode} photoMode={photoMode} />
      )}
      {photoMode && <PhotoCalibOverlay />}
      {photoMode && <PhotoPerspectiveControl />}
    </div>
  )
}

// Précharge la scène chambre si présente
if (typeof window !== 'undefined') {
  try {
    useGLTF.preload('/environnement/chambre/chambre.glb')
  } catch {
    /* ignore */
  }
}
