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
function UnitGroup({
  unit,
  selected,
  wireframe,
  pickMode,
  onPickFace,
  photoMode = false,
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

  return (
    <group ref={groupRef} position={pos}>
      <OssatureView
        dims={unit.dims}
        woodFinish={unit.woodFinish}
        ossatureFinish={unit.ossatureFinish}
        wireframe={wireframe}
        rotationZ={rotY}
        selected={selected}
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

/** Photo de pièce en fond ; le meuble reste la géométrie du configurateur. */
function PhotoEnvironment({ url }) {
  const { scene } = useThree()
  const texture = useTexture(url)
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    const prev = scene.background
    scene.background = texture
    return () => {
      scene.background = prev
    }
  }, [scene, texture])
  return <ShadowFloor />
}

/** Caméra figée (vue photo) : sauvegarde / restauration en quittant la rubrique. */
function PhotoCameraLock() {
  const { camera, controls } = useThree()
  const storeApi = useActiveConfigStoreApi()

  useLayoutEffect(() => {
    const saved = storeApi.getState().photoCamera
    const pos = saved?.pos || DEFAULT_CAMERA_POS
    const target = saved?.target || DEFAULT_CAMERA_TARGET
    camera.position.set(pos[0], pos[1], pos[2])
    camera.lookAt(target[0], target[1], target[2])
    if (controls?.target) {
      controls.target.set(target[0], target[1], target[2])
      controls.update?.()
    }
    return () => {
      storeApi.getState().setPhotoCamera({
        pos: [camera.position.x, camera.position.y, camera.position.z],
        target: controls?.target
          ? [controls.target.x, controls.target.y, controls.target.z]
          : [...DEFAULT_CAMERA_TARGET],
      })
    }
  }, [camera, controls, storeApi])

  return null
}

/**
 * Mini-environnement photo : plan Z=0 figé.
 * Glisser = X/Y · Shift/clic droit = rotation Z · molette = échelle.
 */
function PhotoFloorHandle() {
  const storeApi = useActiveConfigStoreApi()
  const { gl, camera } = useThree()
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const ndc = useMemo(() => new THREE.Vector2(), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const modeRef = useRef(null)
  const lastRef = useRef(null)
  const angle0Ref = useRef(0)
  const rot0Ref = useRef(0)

  useEffect(() => {
    const el = gl.domElement

    const intersectFloor = (ev) => {
      const rect = el.getBoundingClientRect()
      ndc.x = ((ev.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
      ndc.y = -((ev.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      if (!raycaster.ray.intersectPlane(plane, hit)) return null
      return hit.clone()
    }

    const onWheel = (ev) => {
      ev.preventDefault()
      const pose = storeApi.getState().photoPose || { scale: 1 }
      const next = pose.scale * (ev.deltaY > 0 ? 0.92 : 1.08)
      storeApi.getState().setPhotoPose({ scale: next })
    }

    const onDown = (ev) => {
      const p = intersectFloor(ev)
      if (!p) return
      const rotate = Boolean(ev.shiftKey) || ev.button === 2
      modeRef.current = rotate ? 'rotate' : 'move'
      lastRef.current = p
      const pose = storeApi.getState().photoPose || { xMm: 0, yMm: 0, rotZ: 0 }
      const cx = pose.xMm * SCALE
      const cz = -pose.yMm * SCALE
      angle0Ref.current = Math.atan2(p.z - cz, p.x - cx)
      rot0Ref.current = pose.rotZ || 0
      el.setPointerCapture?.(ev.pointerId)
    }

    const onMove = (ev) => {
      if (!modeRef.current || !lastRef.current) return
      const p = intersectFloor(ev)
      if (!p) return
      const pose = storeApi.getState().photoPose || {
        xMm: 0,
        yMm: 0,
        rotZ: 0,
        scale: 1,
      }
      if (modeRef.current === 'move') {
        const dx = p.x - lastRef.current.x
        const dz = p.z - lastRef.current.z
        storeApi.getState().setPhotoPose({
          xMm: pose.xMm + dx / SCALE,
          yMm: pose.yMm - dz / SCALE,
        })
        lastRef.current = p
      } else {
        const cx = pose.xMm * SCALE
        const cz = -pose.yMm * SCALE
        const a = Math.atan2(p.z - cz, p.x - cx)
        const deg = ((a - angle0Ref.current) * 180) / Math.PI
        storeApi.getState().setPhotoPose({ rotZ: rot0Ref.current - deg })
      }
    }

    const onUp = (ev) => {
      modeRef.current = null
      lastRef.current = null
      el.releasePointerCapture?.(ev.pointerId)
    }

    const onContext = (ev) => ev.preventDefault()

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('contextmenu', onContext)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('contextmenu', onContext)
    }
  }, [gl, camera, storeApi, plane, raycaster, ndc, hit])

  return null
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
  const photoPose = useActiveConfigStore((s) => s.photoPose)
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
      {!photoMode && <color attach="background" args={[env.bg || '#0a0a0a']} />}
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
      {photoMode && <PhotoFloorHandle />}

      <group
        position={
          photoMode
            ? [
                (photoPose?.xMm || 0) * SCALE,
                0,
                -(photoPose?.yMm || 0) * SCALE,
              ]
            : [0, 0, 0]
        }
        rotation={
          photoMode ? [0, ((photoPose?.rotZ || 0) * Math.PI) / 180, 0] : [0, 0, 0]
        }
        scale={photoMode ? photoPose?.scale || 1 : 1}
      >
        {units.map((u) => (
          <UnitGroup
            key={u.id}
            unit={u}
            selected={u.id === activeUnitId}
            wireframe={wireframe}
            pickMode={panneauPickMode && !photoMode}
            onPickFace={onPickFace}
            photoMode={photoMode}
          />
        ))}
      </group>

      <ContactShadows
        position={[0, 0.001, 0]}
        opacity={sunEnabled ? 0.22 : 0.35}
        scale={12}
        blur={2.5}
        far={4}
      />

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
  const touch =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(pointer: coarse)').matches
  return (
    <div className="viewport-hint">
      {photoMode
        ? t('config.hintPhoto')
        : pickMode
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
