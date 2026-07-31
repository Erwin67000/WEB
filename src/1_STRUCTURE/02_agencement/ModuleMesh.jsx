import { useMemo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useThree, extend } from '@react-three/fiber'
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
} from './agencement.js'
import {
  FINITIONS,
  DEFAULT_PANNEAU_COULEUR,
  resolvePanneauColor,
  PANNEAU_EDGE_COLOR,
  PANNEAU_EDGE_WIDTH,
  ARETE_EDGE_COLOR,
  ARETE_EDGE_WIDTH,
  EPAISSEUR_PANNEAU,
} from '../00_matrice/matrice_constante.js'

import { useActiveConfigStore } from '../../store/ConfigStoreContext.jsx'

extend({ LineSegments2, LineSegmentsGeometry, LineMaterial })

const SCALE = 0.001

/** Filaire d’un rectangle (4 côtés) — trait fin panneaux. */
function RectangleWire({ rectangle }) {
  const { size, gl } = useThree()
  const lineMatRef = useRef(null)

  const edgeBasic = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(rectangle.wire, 3),
    )
    return geo
  }, [rectangle])

  const edgeFat = useMemo(() => {
    const geo = new LineSegmentsGeometry()
    geo.setPositions(Array.from(rectangle.wire))
    return geo
  }, [rectangle])

  const dpr = gl.getPixelRatio?.() || 1
  const resW = Math.max(1, size.width * dpr)
  const resH = Math.max(1, size.height * dpr)

  useLayoutEffect(() => {
    const mat = lineMatRef.current
    if (mat?.resolution) mat.resolution.set(resW, resH)
  }, [resW, resH])

  useEffect(() => {
    return () => {
      edgeBasic.dispose()
      edgeFat.dispose()
    }
  }, [edgeBasic, edgeFat])

  const color = rectangle.color || PANNEAU_EDGE_COLOR

  return (
    <group>
      <lineSegments geometry={edgeBasic} renderOrder={2}>
        <lineBasicMaterial
          color={color}
          depthTest
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </lineSegments>
      <lineSegments2 geometry={edgeFat} renderOrder={3}>
        <lineMaterial
          ref={lineMatRef}
          color={color}
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

/** Face semi-transparente d’un rectangle (optionnel, lecture). */
function RectangleFace({ rectangle, opacity = 0.12 }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(rectangle.positions, 3),
    )
    geo.setIndex(new THREE.BufferAttribute(rectangle.indices, 1))
    geo.computeVertexNormals()
    return geo
  }, [rectangle])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={rectangle.color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

/**
 * Solide panneau 8 points.
 * Indices / winding : ceux de face_panneau (matrice) — pas de correction auto.
 * Vous redéfinirez la suite de triangles dans matrice_panneau_grok si besoin.
 */
function PanneauSolidMesh({ panneau, color, edgeColor }) {
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
      <mesh geometry={geometry} castShadow receiveShadow renderOrder={0}>
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
      <lineSegments geometry={edgeBasic} renderOrder={2}>
        <lineBasicMaterial
          color={lineColor}
          depthTest
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </lineSegments>
      <lineSegments2 geometry={edgeFat} renderOrder={3}>
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
 * Un panneau (fond | porte | …) : 4 rectangles debug + solide on/off.
 */
export function PanneauView({
  nom,
  dims,
  woodFinish = 'chene',
  panneauCouleur = DEFAULT_PANNEAU_COULEUR,
  panneauCouleurHex,
}) {
  const finish = FINITIONS[woodFinish] || FINITIONS.chene
  const showRectangles = useActiveConfigStore((s) => s.showPanneauRectangles)
  const showSolid = useActiveConfigStore((s) => s.showPanneauSolid)
  const showRectFaces = useActiveConfigStore((s) => s.showPanneauRectFaces)
  const epaisseurPanneau = useActiveConfigStore((s) => s.epaisseurPanneau)
  const epaisseurPorte = useActiveConfigStore((s) => s.epaisseurPorte)

  const data = useMemo(
    () =>
      buildPanneauComplet(nom, dims, {
        epaisseur: nom === 'porte' ? epaisseurPorte : epaisseurPanneau,
      }),
    [nom, dims.L, dims.W, dims.H, epaisseurPanneau, epaisseurPorte],
  )

  const { base, decale, tolerance, arriere } = data.rectangles
  const palette = resolvePanneauColor(panneauCouleur, panneauCouleurHex)
  const solidColor = palette.color
  // Contours panneaux toujours noirs (pas la teinte olive / edge palette)
  const edgeColor = PANNEAU_EDGE_COLOR

  return (
    <group>
      {showRectangles && (
        <group>
          <RectangleWire rectangle={{ ...base, color: edgeColor }} />
          <RectangleWire rectangle={{ ...decale, color: edgeColor }} />
          <RectangleWire rectangle={{ ...tolerance, color: edgeColor }} />
          <RectangleWire rectangle={{ ...arriere, color: edgeColor }} />
          {showRectFaces && (
            <>
              <RectangleFace rectangle={base} opacity={0.08} />
              <RectangleFace rectangle={decale} opacity={0.1} />
              <RectangleFace rectangle={tolerance} opacity={0.14} />
              <RectangleFace rectangle={arriere} opacity={0.14} />
            </>
          )}
        </group>
      )}

      {showSolid && (
        <PanneauSolidMesh
          panneau={data.panneau}
          color={solidColor}
          edgeColor={edgeColor}
        />
      )}
    </group>
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
}) {
  if (!panneaux.length) return null
  return (
    <group>
      {panneaux.map((nom) => (
        <PanneauView
          key={nom}
          nom={nom}
          dims={dims}
          woodFinish={woodFinish}
          panneauCouleur={panneauCouleur}
          panneauCouleurHex={panneauCouleurHex}
        />
      ))}
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
      <mesh geometry={geometry} castShadow receiveShadow renderOrder={0}>
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
      <lineSegments geometry={edgeBasic} renderOrder={2}>
        <lineBasicMaterial
          color={lineColor}
          depthTest
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </lineSegments>
      <lineSegments2 geometry={edgeFat} renderOrder={3}>
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
function RailMesh({ mount, metalColor = '#4a4a4a' }) {
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
        // scale X/Y/Z : rail entièrement sur l’emprise de la traverse
        setGeo(
          railGeometryToThree(gMm, {
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
  // Origine rail en repère meuble → Three
  const pos = [x * SCALE, z * SCALE, -y * SCALE]

  // renderOrder bas : la traverse (solide) masque le rail depuis le dessous
  return (
    <mesh
      geometry={geo}
      position={pos}
      castShadow
      receiveShadow
      renderOrder={0}
    >
      <meshStandardMaterial
        color={metalColor}
        metalness={0.55}
        roughness={0.4}
        // Légèrement en retrait Z-buffer pour rester sous le volume traverse au bord
        polygonOffset
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
      />
    </mesh>
  )
}

/** Tiroir Würth type B : traverses + rails + boîte ouverte Z-top. */
function TiroirMesh({ dims, layout, mod, plateColor, woodColor, woodRoughness }) {
  const data = useMemo(() => {
    try {
      return buildTiroir(dims, layout, mod)
    } catch (e) {
      console.error('[TiroirMesh]', e)
      return null
    }
  }, [dims.L, dims.W, dims.H, layout, mod?.hMm, mod?.id])

  if (!data) return null

  return (
    <group>
      {/* Rails d’abord : masqués par les traverses (fixation sur le dessus) */}
      {data.rails.map((r) => (
        <RailMesh key={r.id} mount={r} />
      ))}
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
      {data.box.panels.map((p) => (
        <SolidWireMesh
          key={p.id}
          positions={p.positions}
          indices={p.indices}
          wire={p.wire}
          color={plateColor}
          edgeColor={PANNEAU_EDGE_COLOR}
          wireWidth={PANNEAU_EDGE_WIDTH}
        />
      ))}
    </group>
  )
}

export function ModulesMesh({
  dims,
  modules = [],
  woodFinish = 'chene',
  panneauCouleur = DEFAULT_PANNEAU_COULEUR,
  panneauCouleurHex,
}) {
  const finish = FINITIONS[woodFinish] || FINITIONS.chene
  const darker = finish.edge
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
              woodColor={finish.color}
              woodRoughness={0.55}
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
              plateColor={shelfColor}
              woodColor={finish.color}
              woodRoughness={0.55}
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
                  color={finish.color}
                  roughness={0.55}
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
  woodFinish = 'chene',
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
        </group>
      </group>

      <group position={[0, 0, 0]}>
        <ModulesMesh
          dims={dims}
          modules={modules}
          woodFinish={woodFinish}
          panneauCouleur={panneauCouleur}
          panneauCouleurHex={panneauCouleurHex}
        />
      </group>
    </>
  )
}
