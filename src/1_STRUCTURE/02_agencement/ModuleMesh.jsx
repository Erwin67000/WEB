import { useMemo } from 'react'
import * as THREE from 'three'
import { buildPanneauComplet, moduleLayout } from './agencement.js'
import {
  FINITIONS,
  PANNEAU_COULEURS,
  DEFAULT_PANNEAU_COULEUR,
  resolvePanneauColor,
} from '../00_matrice/matrice_constante.js'
import { inflateWireMm } from '../01_meuble3D/edgeWire.js'
import { useActiveConfigStore } from '../../store/ConfigStoreContext.jsx'

const SCALE = 0.001

/** Filaire d’un rectangle (4 côtés). */
function RectangleWire({ rectangle }) {
  const edges = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(rectangle.wire, 3),
    )
    return geo
  }, [rectangle])

  return (
    <lineSegments geometry={edges}>
      <lineBasicMaterial color={rectangle.color} linewidth={2} />
    </lineSegments>
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
  const { geometry, edgeInflated } = useMemo(() => {
    const buf = panneau.toBuffers()
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(buf.positions, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(buf.uvs, 2))
    geo.setIndex(new THREE.BufferAttribute(buf.indices, 1))
    geo.computeVertexNormals()

    const w = inflateWireMm(buf.wire, 0.9)
    const edgeGeo = new THREE.BufferGeometry()
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(w, 3))

    return { geometry: geo, edgeInflated: edgeGeo }
  }, [panneau])

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow renderOrder={0}>
        <meshStandardMaterial
          color={color}
          roughness={0.55}
          metalness={0.04}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={1.5}
          polygonOffsetUnits={2}
        />
      </mesh>
      <lineSegments geometry={edgeInflated} renderOrder={2}>
        <lineBasicMaterial
          color={edgeColor || '#0a0a0a'}
          depthTest
          depthWrite={false}
        />
      </lineSegments>
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
  const edgeColor = palette.edge || finish.edge

  return (
    <group>
      {showRectangles && (
        <group>
          <RectangleWire rectangle={base} />
          <RectangleWire rectangle={decale} />
          <RectangleWire rectangle={tolerance} />
          <RectangleWire rectangle={arriere} />
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
        if (mod.kind === 'drawer') {
          return (
            <group key={mod.id}>
              <BoxAt
                center={layout.center}
                size={layout.size}
                color={darker}
                opacity={0.9}
              />
              {layout.faceCenter && (
                <BoxAt
                  center={layout.faceCenter}
                  size={layout.faceSize}
                  color={finish.color}
                />
              )}
            </group>
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
