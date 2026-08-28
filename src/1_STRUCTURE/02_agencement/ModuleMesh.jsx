import { useMemo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useThree, useFrame, extend } from '@react-three/fiber'
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import {
  buildPanneauComplet,
  moduleLayout,
  buildTablette,
  buildTiroir,
  normalizeRailGeometry,
  railGeometryToThree,
  DRAWER_OPEN_DEPTH_RATIO,
  DRAWER_OPEN_DURATION_MS,
  porteGroupsForUnit,
  porteGroupBuildParams,
  porteXSplit,
  faceGroupsForUnit,
  faceGroupBuildParams,
  SEGMENTED_FACES,
} from './agencement.js'
import {
  FINITIONS,
  FINITIONS_OSSATURE,
  DEFAULT_FINITION_OSSATURE,
  DEFAULT_PANNEAU_COULEUR,
  resolvePanneauColor,
  PANNEAU_EDGE_COLOR,
  PANNEAU_EDGE_WIDTH,
  ARETE_EDGE_COLOR,
  ARETE_EDGE_WIDTH,
  EPAISSEUR_PANNEAU,
  PORTE_OPEN_DURATION_MS,
  PORTE_OPEN_ANGLE_RAD,
} from '../00_matrice/matrice_constante.js'

import { useActiveConfigStore } from '../../store/ConfigStoreContext.jsx'

extend({ LineSegments2, LineSegmentsGeometry, LineMaterial })

const SCALE = 0.001

function shadeHex(hex, factor) {
  const c = new THREE.Color(hex)
  c.multiplyScalar(factor)
  return `#${c.getHexString()}`
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function ossatureWoodColor(woodFinish, ossatureFinish) {
  const finish = FINITIONS[woodFinish] || FINITIONS.chene
  const surf =
    FINITIONS_OSSATURE[ossatureFinish] ||
    FINITIONS_OSSATURE[DEFAULT_FINITION_OSSATURE]
  return shadeHex(finish.color, surf.shade ?? 1)
}

/**
 * Solide panneau 8 points.
 * Indices / winding : ceux de face_panneau (matrice) — pas de correction auto.
 * Vous redéfinirez la suite de triangles dans matrice_panneau_grok si besoin.
 */
function PanneauSolidMesh({ panneau, color, edgeColor, pickable = true }) {
  const { size, gl } = useThree()
  const lineMatRef = useRef(null)

  const { geometry, edgeBasic, edgeFat } = useMemo(() => {
    const buf = panneau.toBuffers()
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(buf.positions, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(buf.uvs, 2))
    geo.setIndex(new THREE.BufferAttribute(buf.indices, 1))
    geo.computeVertexNormals()

    const basic = new THREE.BufferGeometry()
    basic.setAttribute(
      'position',
      new THREE.BufferAttribute(buf.wire.slice(), 3),
    )

    const fat = new LineSegmentsGeometry()
    fat.setPositions(Array.from(buf.wire))

    return { geometry: geo, edgeBasic: basic, edgeFat: fat }
  }, [panneau])

  const dpr = gl.getPixelRatio?.() || 1
  const resW = Math.max(1, size.width * dpr)
  const resH = Math.max(1, size.height * dpr)

  useLayoutEffect(() => {
    const mat = lineMatRef.current
    if (mat?.resolution) mat.resolution.set(resW, resH)
  }, [resW, resH])

  useEffect(() => {
    return () => {
      geometry.dispose()
      edgeBasic.dispose()
      edgeFat.dispose()
    }
  }, [geometry, edgeBasic, edgeFat])

  const lineColor = edgeColor || PANNEAU_EDGE_COLOR

  return (
    <group>
      <mesh
        geometry={geometry}
        castShadow
        receiveShadow
        renderOrder={0}
        {...(!pickable ? { raycast: () => {} } : {})}
      >
        <meshStandardMaterial
          color={color}
          roughness={0.55}
          metalness={0.04}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
        />
      </mesh>
      {/* Contour panneau : plus fin que les arêtes ossature (ARETE_EDGE_WIDTH) */}
      <lineSegments geometry={edgeBasic} renderOrder={2} raycast={() => {}}>
        <lineBasicMaterial
          color={lineColor}
          depthTest
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </lineSegments>
      <lineSegments2 geometry={edgeFat} renderOrder={3} raycast={() => {}}>
        <lineMaterial
          ref={lineMatRef}
          color={lineColor}
          linewidth={PANNEAU_EDGE_WIDTH}
          depthTest
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
          resolution={[resW, resH]}
        />
      </lineSegments2>
    </group>
  )
}

/**
 * Un panneau (fond | porte | …) — solide 8 points.
 */
export function PanneauView({
  nom,
  dims,
  panneauCouleur = DEFAULT_PANNEAU_COULEUR,
  panneauCouleurHex,
  porteZMin,
}) {
  const epaisseurPanneau = useActiveConfigStore((s) => s.epaisseurPanneau)
  const epaisseurPorte = useActiveConfigStore((s) => s.epaisseurPorte)

  const data = useMemo(
    () =>
      buildPanneauComplet(nom, dims, {
        epaisseur: nom === 'porte' ? epaisseurPorte : epaisseurPanneau,
        ...(nom === 'porte' && porteZMin > 0 ? { zMin: porteZMin } : {}),
      }),
    [nom, dims.L, dims.W, dims.H, epaisseurPanneau, epaisseurPorte, porteZMin],
  )

  const palette = resolvePanneauColor(panneauCouleur, panneauCouleurHex)
  const solidColor = palette.color
  const edgeColor = PANNEAU_EDGE_COLOR

  return (
    <PanneauSolidMesh
      panneau={data.panneau}
      color={solidColor}
      edgeColor={edgeColor}
    />
  )
}

/** Alias fond */
export function FondView(props) {
  return <PanneauView nom="fond" {...props} />
}

/** Alias porte (X1 / X3) */
export function PorteView(props) {
  return <PanneauView nom="porte" {...props} />
}

/** Liste des panneaux cochés — vide = aucun panneau (choix utilisateur). */
export function PanneauxMesh({
  dims,
  panneaux = [],
  woodFinish = 'chene',
  panneauCouleur = DEFAULT_PANNEAU_COULEUR,
  panneauCouleurHex,
  porteZMin = 0,
}) {
  if (!panneaux.length) return null
  return (
    <group>
      {panneaux
        .filter((nom) => nom !== 'porte' && !SEGMENTED_FACES.includes(nom))
        .map((nom) => (
          <PanneauView
            key={nom}
            nom={nom}
            dims={dims}
            woodFinish={woodFinish}
            panneauCouleur={panneauCouleur}
            panneauCouleurHex={panneauCouleurHex}
            porteZMin={porteZMin}
          />
        ))}
    </group>
  )
}

function DoorLeaf({
  dims,
  modules,
  group,
  color,
  openTarget = 0,
  hinge = 'left',
  xMin,
  xMax,
  openKey,
}) {
  const epaisseurPorte = useActiveConfigStore((s) => s.epaisseurPorte)
  const panneauPickMode = useActiveConfigStore((s) => s.panneauPickMode)
  const togglePorteOpen = useActiveConfigStore((s) => s.togglePorteOpen)
  const pivotRef = useRef()
  const visualRef = useRef(openTarget)
  const fromRef = useRef(openTarget)
  const toRef = useRef(openTarget)
  const t0Ref = useRef(0)
  const [targetOpen, setTargetOpen] = useState(openTarget)
  const side = hinge === 'right' ? 'right' : 'left'
  const angleSign = side === 'right' ? -1 : 1

  const data = useMemo(() => {
    const extra = {}
    if (Number.isFinite(Number(xMin))) extra.xMin = Number(xMin)
    if (Number.isFinite(Number(xMax))) extra.xMax = Number(xMax)
    const params = porteGroupBuildParams(group, dims, modules, extra)
    return buildPanneauComplet('porte', dims, {
      epaisseur: epaisseurPorte,
      ...params,
    })
  }, [
    dims.L,
    dims.W,
    dims.H,
    group.key,
    group.zMin,
    group.zMax,
    group.isTop,
    group.isBottom,
    epaisseurPorte,
    modules,
    xMin,
    xMax,
  ])

  const hingePt = useMemo(() => {
    const pts = data?.panneau?.points || []
    if (!pts.length) return { x: 0, y: dims.W || 0 }
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    return {
      x: side === 'right' ? Math.max(...xs) : Math.min(...xs),
      y: Math.max(...ys),
    }
  }, [data, dims.W, side])

  useEffect(() => {
    setTargetOpen(openTarget)
  }, [openTarget])

  useEffect(() => {
    fromRef.current = visualRef.current
    toRef.current = targetOpen
    t0Ref.current = performance.now()
  }, [targetOpen])

  useFrame(() => {
    const g = pivotRef.current
    if (!g) return
    const from = fromRef.current
    const to = toRef.current
    if (from !== to) {
      const t = Math.min(
        1,
        (performance.now() - t0Ref.current) / PORTE_OPEN_DURATION_MS,
      )
      visualRef.current = from + (to - from) * easeInOutCubic(t)
      if (t >= 1) {
        visualRef.current = to
        fromRef.current = to
      }
    }
    g.rotation.z = visualRef.current * PORTE_OPEN_ANGLE_RAD * angleSign
  })

  if (!data?.panneau) return null

  const handleToggle = (e) => {
    e.stopPropagation()
    if (panneauPickMode) return
    const key = openKey || group.key
    if (key) togglePorteOpen(key)
  }

  return (
    <group
      ref={pivotRef}
      position={[hingePt.x, hingePt.y, 0]}
      onClick={panneauPickMode ? undefined : handleToggle}
      onPointerOver={
        panneauPickMode
          ? undefined
          : (e) => {
              const first = e.intersections?.[0]
              if (!first || first.object !== e.object) return
              e.stopPropagation()
              document.body.style.cursor = 'pointer'
            }
      }
      onPointerOut={
        panneauPickMode
          ? undefined
          : () => {
              document.body.style.cursor = 'auto'
            }
      }
    >
      <group position={[-hingePt.x, -hingePt.y, 0]}>
        <PanneauSolidMesh
          panneau={data.panneau}
          color={color}
          edgeColor={PANNEAU_EDGE_COLOR}
          pickable={!panneauPickMode}
        />
      </group>
    </group>
  )
}

export function FaceSegments({
  nom,
  dims,
  modules = [],
  panneaux = [],
  baysField,
  panneauCouleur,
  panneauCouleurHex,
}) {
  const epaisseurPanneau = useActiveConfigStore((s) => s.epaisseurPanneau)
  const panneauPickMode = useActiveConfigStore((s) => s.panneauPickMode)
  const groups = useMemo(
    () =>
      faceGroupsForUnit(
        {
          dims,
          modules,
          panneaux,
          [`${nom}Bays`]: baysField,
        },
        nom,
      ),
    [nom, dims.L, dims.W, dims.H, modules, panneaux, baysField],
  )
  const palette = resolvePanneauColor(panneauCouleur, panneauCouleurHex)

  return (
    <group>
      {groups.map((g) => (
        <FaceSegmentMesh
          key={`${nom}-${g.key}`}
          nom={nom}
          dims={dims}
          modules={modules}
          group={g}
          color={palette.color}
          epaisseur={epaisseurPanneau}
          pickable={!panneauPickMode}
        />
      ))}
    </group>
  )
}

function FaceSegmentMesh({ nom, dims, modules, group, color, epaisseur, pickable }) {
  const data = useMemo(() => {
    const params = faceGroupBuildParams(group, dims, modules)
    return buildPanneauComplet(nom, dims, {
      epaisseur,
      ...params,
    })
  }, [
    nom,
    dims.L,
    dims.W,
    dims.H,
    group.key,
    group.zMin,
    group.zMax,
    group.isTop,
    group.isBottom,
    group.kind,
    epaisseur,
    modules,
  ])
  if (!data?.panneau) return null
  return (
    <PanneauSolidMesh
      panneau={data.panneau}
      color={color}
      edgeColor={PANNEAU_EDGE_COLOR}
      pickable={pickable}
    />
  )
}

export function DoorLeaves({
  dims,
  modules = [],
  panneaux = [],
  porteBays,
  porteOpen = {},
  porteHinge = {},
  panneauCouleur,
  panneauCouleurHex,
}) {
  const groups = useMemo(
    () =>
      porteGroupsForUnit({
        dims,
        modules,
        panneaux,
        porteBays,
      }),
    [dims.L, dims.W, dims.H, modules, panneaux, porteBays],
  )
  const split = useMemo(() => porteXSplit(dims), [dims.L, dims.W, dims.H])
  const palette = resolvePanneauColor(panneauCouleur, panneauCouleurHex)
  if (!groups.length) return null
  return (
    <group>
      {groups.map((g) => {
        const hinge = porteHinge?.[g.key] || 'left'
        if (hinge === 'center') {
          return (
            <group key={g.key}>
              <DoorLeaf
                dims={dims}
                modules={modules}
                group={g}
                color={palette.color}
                hinge="left"
                xMax={split.xMid}
                openKey={`${g.key}:L`}
                openTarget={Number(porteOpen?.[`${g.key}:L`]) > 0.5 ? 1 : 0}
              />
              <DoorLeaf
                dims={dims}
                modules={modules}
                group={g}
                color={palette.color}
                hinge="right"
                xMin={split.xMid}
                openKey={`${g.key}:R`}
                openTarget={Number(porteOpen?.[`${g.key}:R`]) > 0.5 ? 1 : 0}
              />
            </group>
          )
        }
        return (
          <DoorLeaf
            key={g.key}
            dims={dims}
            modules={modules}
            group={g}
            color={palette.color}
            hinge={hinge}
            openKey={g.key}
            openTarget={Number(porteOpen?.[g.key]) > 0.5 ? 1 : 0}
          />
        )
      })}
    </group>
  )
}

function BoxAt({ center, size, color, opacity = 1 }) {
  const args = useMemo(
    () => [size[0] * SCALE, size[2] * SCALE, size[1] * SCALE],
    [size],
  )
  const pos = [
    center[0] * SCALE,
    center[2] * SCALE,
    -center[1] * SCALE,
  ]
  return (
    <mesh position={pos} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={color}
        roughness={0.6}
        metalness={0.02}
        transparent={opacity < 1}
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/**
 * Rendu d’un buffer solide + filaire (coords meuble mm → Three).
 * wireWidth : PANNEAU_EDGE_WIDTH (tablette) ou ARETE_EDGE_WIDTH (traverse).
 */
function SolidWireMesh({
  positions,
  indices,
  wire,
  color,
  edgeColor,
  wireWidth,
  roughness = 0.55,
  metalness = 0.04,
  onClick,
  onPointerDown,
  onPointerOver,
  onPointerOut,
}) {
  const { size, gl } = useThree()
  const lineMatRef = useRef(null)

  const { geometry, edgeBasic, edgeFat } = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    // Meuble mm (X,Y,Z) → Three (X, Z, −Y) × SCALE
    const n = positions.length / 3
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const x = positions[i * 3]
      const y = positions[i * 3 + 1]
      const z = positions[i * 3 + 2]
      pos[i * 3] = x * SCALE
      pos[i * 3 + 1] = z * SCALE
      pos[i * 3 + 2] = -y * SCALE
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setIndex(new THREE.BufferAttribute(indices.slice(), 1))
    geo.computeVertexNormals()

    const wCount = wire.length / 6
    const wPos = new Float32Array(wCount * 6)
    for (let i = 0; i < wCount; i++) {
      const o = i * 6
      wPos[o] = wire[o] * SCALE
      wPos[o + 1] = wire[o + 2] * SCALE
      wPos[o + 2] = -wire[o + 1] * SCALE
      wPos[o + 3] = wire[o + 3] * SCALE
      wPos[o + 4] = wire[o + 5] * SCALE
      wPos[o + 5] = -wire[o + 4] * SCALE
    }
    const basic = new THREE.BufferGeometry()
    basic.setAttribute('position', new THREE.BufferAttribute(wPos, 3))

    const fat = new LineSegmentsGeometry()
    fat.setPositions(Array.from(wPos))

    return { geometry: geo, edgeBasic: basic, edgeFat: fat }
  }, [positions, indices, wire])

  const dpr = gl.getPixelRatio?.() || 1
  const resW = Math.max(1, size.width * dpr)
  const resH = Math.max(1, size.height * dpr)

  useLayoutEffect(() => {
    const mat = lineMatRef.current
    if (mat?.resolution) mat.resolution.set(resW, resH)
  }, [resW, resH])

  useEffect(() => {
    return () => {
      geometry.dispose()
      edgeBasic.dispose()
      edgeFat.dispose()
    }
  }, [geometry, edgeBasic, edgeFat])

  const lineColor = edgeColor || PANNEAU_EDGE_COLOR

  return (
    <group>
      <mesh
        geometry={geometry}
        castShadow
        receiveShadow
        renderOrder={0}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <meshStandardMaterial
          color={color}
          roughness={roughness}
          metalness={metalness}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
        />
      </mesh>
      <lineSegments geometry={edgeBasic} renderOrder={2} raycast={() => {}}>
        <lineBasicMaterial
          color={lineColor}
          depthTest
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </lineSegments>
      <lineSegments2 geometry={edgeFat} renderOrder={3} raycast={() => {}}>
        <lineMaterial
          ref={lineMatRef}
          color={lineColor}
          linewidth={wireWidth}
          depthTest
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
          resolution={[resW, resH]}
        />
      </lineSegments2>
    </group>
  )
}

/** Tablette : plateau octogone (extrusion −Z) + paire de traverses (+Z). */
function TabletteMesh({ dims, zTopMm, plateColor, woodColor, woodRoughness }) {
  const data = useMemo(() => {
    try {
      return buildTablette(dims, zTopMm, { epaisseurMm: EPAISSEUR_PANNEAU })
    } catch (e) {
      console.error('[TabletteMesh]', e)
      return null
    }
  }, [dims.L, dims.W, dims.H, zTopMm])

  if (!data?.plate) return null

  return (
    <group>
      <SolidWireMesh
        positions={data.plate.positions}
        indices={data.plate.indices}
        wire={data.plate.wire}
        color={plateColor}
        edgeColor={PANNEAU_EDGE_COLOR}
        wireWidth={PANNEAU_EDGE_WIDTH}
      />
      {data.traverses.map((tr) => (
        <SolidWireMesh
          key={tr.id}
          positions={tr.positions}
          indices={tr.indices}
          wire={tr.wire}
          color={woodColor}
          edgeColor={ARETE_EDGE_COLOR}
          wireWidth={ARETE_EDGE_WIDTH}
          roughness={woodRoughness ?? 0.55}
          metalness={0.05}
        />
      ))}
    </group>
  )
}

/** Cache géométrie rail normalisée (mm, Y=longueur). */
let _railGeoMmPromise = null
function loadNormalizedRailMm(url) {
  if (!_railGeoMmPromise) {
    _railGeoMmPromise = new Promise((resolve, reject) => {
      const loader = new STLLoader()
      loader.load(
        url,
        (geo) => {
          try {
            resolve(normalizeRailGeometry(geo))
          } catch (e) {
            reject(e)
          }
        },
        undefined,
        reject,
      )
    })
  }
  return _railGeoMmPromise
}

/**
 * Rail aligné axe Y des traverses.
 * position = origine meuble mm (début traverse en Y, face intérieure en X).
 */
/** Inox brossé — metalness trop haut + sans envmap = noir. */
const RAIL_METAL_COLOR = '#d5dde0'

function RailMesh({ mount }) {
  const [geo, setGeo] = useState(null)
  const scaleX = mount.scale?.x ?? 1
  const scaleY = mount.scale?.y ?? 1
  const scaleZ = mount.scale?.z ?? 1
  const mirrorX = Boolean(mount.mirrorX)

  useEffect(() => {
    let cancelled = false
    loadNormalizedRailMm(mount.stlUrl)
      .then((gMm) => {
        if (cancelled) return
        const g = gMm.clone()
        if (g.getAttribute('color')) g.deleteAttribute('color')
        setGeo(
          railGeometryToThree(g, {
            scaleX,
            scaleY,
            scaleZ,
            mirrorX,
          }),
        )
      })
      .catch((e) => console.warn('[RailMesh]', e.message))
    return () => {
      cancelled = true
    }
  }, [mount.stlUrl, scaleX, scaleY, scaleZ, mirrorX])

  if (!geo) return null

  const [x, y, z] = mount.position
  const pos = [x * SCALE, z * SCALE, -y * SCALE]

  // Au-dessus de la traverse, sous le panneau (coin L)
  return (
    <mesh
      geometry={geo}
      position={pos}
      castShadow
      receiveShadow
      renderOrder={1}
    >
      <meshStandardMaterial
        color={RAIL_METAL_COLOR}
        metalness={0.35}
        roughness={0.32}
        envMapIntensity={0.4}
      />
    </mesh>
  )
}

/** Tiroir Würth type B : traverses + rails fixes + panels animés Y+. */
function TiroirMesh({ dims, layout, mod, woodColor, woodRoughness, plateColor }) {
  const setModuleOpen = useActiveConfigStore((s) => s.setModuleOpen)
  const panneauPickMode = useActiveConfigStore((s) => s.panneauPickMode)
  const panelGroupRef = useRef()
  const visualRef = useRef(Number(mod?.openFactor) || 0)
  const fromRef = useRef(visualRef.current)
  const toRef = useRef(visualRef.current)
  const t0Ref = useRef(0)
  const [targetOpen, setTargetOpen] = useState(Number(mod?.openFactor) || 0)

  const data = useMemo(() => {
    try {
      return buildTiroir(dims, layout, mod)
    } catch (e) {
      console.error('[TiroirMesh]', e)
      return null
    }
  }, [
    dims.L,
    dims.W,
    dims.H,
    layout?.zMm,
    layout?.zBottomMm,
    layout?.hMm,
    layout?.wurth?.hMm,
    layout?.wurth?.depthMm,
    layout?.facadeBas,
    layout?.drawerIndex,
    mod?.hMm,
    mod?.id,
  ])

  useEffect(() => {
    setTargetOpen(Number(mod?.openFactor) || 0)
  }, [mod?.openFactor])

  useEffect(() => {
    fromRef.current = visualRef.current
    toRef.current = targetOpen
    t0Ref.current = performance.now()
  }, [targetOpen])

  useEffect(() => {
    return () => {
      document.body.style.cursor = 'auto'
    }
  }, [])

  useFrame(() => {
    const g = panelGroupRef.current
    if (!g) return
    const from = fromRef.current
    const to = toRef.current
    if (from !== to) {
      const t = Math.min(
        1,
        (performance.now() - t0Ref.current) / DRAWER_OPEN_DURATION_MS,
      )
      visualRef.current = from + (to - from) * easeInOutCubic(t)
      if (t >= 1) {
        visualRef.current = to
        fromRef.current = to
      }
    }
    const yMm = visualRef.current * DRAWER_OPEN_DEPTH_RATIO * (Number(dims.W) || 0)
    g.position.set(0, 0, -yMm * SCALE)
  })

  if (!data || data.lwkOutOfRange || data.depthTooSmall) return null

  const handleToggle = (e) => {
    const first = e.intersections?.[0]
    if (first && first.object !== e.object) return
    e.stopPropagation()
    if (panneauPickMode || data.depthTooSmall || data.lwkOutOfRange) return
    const next = targetOpen > 0.5 ? 0 : 1
    setTargetOpen(next)
    if (mod?.id) setModuleOpen(mod.id, next)
  }

  const handlePointerDown = (e) => {
    const first = e.intersections?.[0]
    if (first && first.object !== e.object) return
    e.stopPropagation()
  }

  const handleOver = (e) => {
    const first = e.intersections?.[0]
    if (first && first.object !== e.object) return
    e.stopPropagation()
    document.body.style.cursor = 'pointer'
  }

  const handleOut = () => {
    document.body.style.cursor = 'auto'
  }

  return (
    <group>
      {data.traverses.map((tr) => (
        <SolidWireMesh
          key={tr.id}
          positions={tr.positions}
          indices={tr.indices}
          wire={tr.wire}
          color={woodColor}
          edgeColor={ARETE_EDGE_COLOR}
          wireWidth={ARETE_EDGE_WIDTH}
          roughness={woodRoughness ?? 0.55}
          metalness={0.05}
        />
      ))}
      {data.rails.map((r) => (
        <RailMesh key={r.id} mount={r} />
      ))}
      <group ref={panelGroupRef}>
        {data.box.panels.map((p) => {
          const isFacade = p.id === 'facade'
          return (
            <SolidWireMesh
              key={p.id}
              positions={p.positions}
              indices={p.indices}
              wire={p.wire}
              color={isFacade ? plateColor : woodColor}
              edgeColor={isFacade ? PANNEAU_EDGE_COLOR : ARETE_EDGE_COLOR}
              wireWidth={isFacade ? PANNEAU_EDGE_WIDTH : ARETE_EDGE_WIDTH}
              roughness={woodRoughness ?? 0.55}
              metalness={0.05}
              onClick={handleToggle}
              onPointerDown={handlePointerDown}
              onPointerOver={handleOver}
              onPointerOut={handleOut}
            />
          )
        })}
      </group>
    </group>
  )
}

export function ModulesMesh({
  dims,
  modules = [],
  woodFinish = 'chene',
  ossatureFinish = DEFAULT_FINITION_OSSATURE,
  panneauCouleur = DEFAULT_PANNEAU_COULEUR,
  panneauCouleurHex,
}) {
  const finish = FINITIONS[woodFinish] || FINITIONS.chene
  const surf =
    FINITIONS_OSSATURE[ossatureFinish] ||
    FINITIONS_OSSATURE[DEFAULT_FINITION_OSSATURE]
  const woodColor = ossatureWoodColor(woodFinish, ossatureFinish)
  const shelfColor =
    resolvePanneauColor(panneauCouleur, panneauCouleurHex).color || finish.color

  return (
    <group>
      {modules.map((mod) => {
        const layout = moduleLayout(mod, dims, modules)
        if (mod.kind === 'shelf') {
          return (
            <TabletteMesh
              key={mod.id}
              dims={dims}
              zTopMm={layout.zTopMm ?? layout.zMm ?? layout.center[2]}
              plateColor={shelfColor}
              woodColor={woodColor}
              woodRoughness={surf.roughness ?? 0.55}
            />
          )
        }
        if (mod.kind === 'drawer') {
          return (
            <TiroirMesh
              key={mod.id}
              dims={dims}
              layout={layout}
              mod={mod}
              woodColor={woodColor}
              woodRoughness={surf.roughness ?? 0.55}
              plateColor={shelfColor}
            />
          )
        }
        if (mod.kind === 'door') {
          const hinge = layout.hinge || layout.center
          return (
            <group
              key={mod.id}
              position={[
                hinge[0] * SCALE,
                hinge[2] * SCALE,
                -hinge[1] * SCALE,
              ]}
              rotation={[0, layout.openAngle || 0, 0]}
            >
              <mesh
                position={[(layout.size[0] / 2) * SCALE, 0, 0]}
                castShadow
                receiveShadow
              >
                <boxGeometry
                  args={[
                    layout.size[0] * SCALE,
                    layout.size[2] * SCALE,
                    layout.size[1] * SCALE,
                  ]}
                />
                <meshStandardMaterial
                  color={woodColor}
                  roughness={surf.roughness ?? 0.55}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          )
        }
        return (
          <BoxAt
            key={mod.id}
            center={layout.center}
            size={layout.size}
            color={shelfColor}
          />
        )
      })}
    </group>
  )
}

export default function AgencementView({
  dims,
  modules = [],
  panneaux = ['fond'],
  porteBays,
  porteOpen,
  porteHinge,
  fondBays,
  joue1Bays,
  joue2Bays,
  woodFinish = 'chene',
  ossatureFinish = DEFAULT_FINITION_OSSATURE,
  panneauCouleur = DEFAULT_PANNEAU_COULEUR,
  panneauCouleurHex,
}) {
  return (
    <>
      <group scale={[SCALE, SCALE, SCALE]}>
        {/* Origine fixe (0,0,0) — même repère que l’ossature */}
        <group position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <PanneauxMesh
            dims={dims}
            panneaux={panneaux}
            woodFinish={woodFinish}
            panneauCouleur={panneauCouleur}
            panneauCouleurHex={panneauCouleurHex}
          />
          <FaceSegments
            nom="fond"
            dims={dims}
            modules={modules}
            panneaux={panneaux}
            baysField={fondBays}
            panneauCouleur={panneauCouleur}
            panneauCouleurHex={panneauCouleurHex}
          />
          <FaceSegments
            nom="joue1"
            dims={dims}
            modules={modules}
            panneaux={panneaux}
            baysField={joue1Bays}
            panneauCouleur={panneauCouleur}
            panneauCouleurHex={panneauCouleurHex}
          />
          <FaceSegments
            nom="joue2"
            dims={dims}
            modules={modules}
            panneaux={panneaux}
            baysField={joue2Bays}
            panneauCouleur={panneauCouleur}
            panneauCouleurHex={panneauCouleurHex}
          />
          <DoorLeaves
            dims={dims}
            modules={modules}
            panneaux={panneaux}
            porteBays={porteBays}
            porteOpen={porteOpen}
            porteHinge={porteHinge}
            panneauCouleur={panneauCouleur}
            panneauCouleurHex={panneauCouleurHex}
          />
        </group>
      </group>

      <group position={[0, 0, 0]}>
        <ModulesMesh
          dims={dims}
          modules={modules}
          woodFinish={woodFinish}
          ossatureFinish={ossatureFinish}
          panneauCouleur={panneauCouleur}
          panneauCouleurHex={panneauCouleurHex}
        />
      </group>
    </>
  )
}
