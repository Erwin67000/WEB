import { useMemo } from 'react'
import * as THREE from 'three'
import { buildOssature } from './ossature.js'
import {
  FINITIONS,
  FINITIONS_OSSATURE,
  DEFAULT_FINITION_OSSATURE,
} from '../00_matrice/matrice_constante.js'

/**
 * Rendu des 12 arêtes d'un meuble Philae.
 * Coordonnées en mm → scale 0.001 vers mètres Three.js.
 * Faces : DoubleSide comme avant (pas d’inversion de winding).
 */
const SCALE = 0.001

function shadeHex(hex, factor) {
  const c = new THREE.Color(hex)
  c.multiplyScalar(factor)
  return `#${c.getHexString()}`
}

function AreteMesh({ mesh, color, edgeColor, wireframe, roughness, metalness }) {
  const { geometry, edges } = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
    geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
    geo.computeVertexNormals()

    const edgeGeo = new THREE.BufferGeometry()
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(mesh.wire, 3))

    return { geometry: geo, edges: edgeGeo }
  }, [mesh])

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={color}
          roughness={roughness ?? 0.55}
          metalness={metalness ?? 0.05}
          side={THREE.DoubleSide}
          wireframe={wireframe}
        />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={edgeColor} linewidth={1} />
      </lineSegments>
    </group>
  )
}

export default function OssatureView({
  dims,
  woodFinish = 'chene',
  ossatureFinish = DEFAULT_FINITION_OSSATURE,
  wireframe = false,
  position = [0, 0, 0],
  rotationZ = 0,
  selected = false,
}) {
  const ossature = useMemo(
    () => buildOssature(dims),
    [dims.L, dims.W, dims.H],
  )
  const finish = FINITIONS[woodFinish] || FINITIONS.chene
  const surf =
    FINITIONS_OSSATURE[ossatureFinish] ||
    FINITIONS_OSSATURE[DEFAULT_FINITION_OSSATURE]

  const color = selected
    ? '#d4b896'
    : shadeHex(finish.color, surf.shade ?? 1)
  const edgeColor = selected ? '#2d6a4f' : finish.edge

  // Three.js: Y up — on mappe Z meuble → Y scene, Y meuble → -Z scene
  return (
    <group
      position={position}
      rotation={[0, rotationZ, 0]}
      scale={[SCALE, SCALE, SCALE]}
    >
      <group
        position={[-dims.L / 2, 0, dims.W / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {ossature.meshes.map((m) => (
          <AreteMesh
            key={m.id}
            mesh={m}
            color={color}
            edgeColor={edgeColor}
            wireframe={wireframe}
            roughness={surf.roughness}
            metalness={surf.metalness}
          />
        ))}
        {selected && (
          <axesHelper args={[Math.max(dims.L, dims.W, dims.H) * 0.35]} />
        )}
      </group>
    </group>
  )
}
