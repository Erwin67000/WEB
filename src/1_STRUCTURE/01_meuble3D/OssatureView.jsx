import { useMemo, useEffect, useLayoutEffect, useRef } from 'react'
import { useThree, extend } from '@react-three/fiber'
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { buildOssature } from './ossature.js'
import {
  FINITIONS,
  FINITIONS_OSSATURE,
  DEFAULT_FINITION_OSSATURE,
  ARETE_EDGE_COLOR,
  ARETE_EDGE_WIDTH,
} from '../00_matrice/matrice_constante.js'

extend({ LineSegments2, LineSegmentsGeometry, LineMaterial })

/**
 * Contours d’arêtes : position exacte des wires (pas de dilatation géométrique).
 * Anti z-fighting via polygonOffset depth-buffer uniquement.
 */
const SCALE = 0.001

function shadeHex(hex, factor) {
  const c = new THREE.Color(hex)
  c.multiplyScalar(factor)
  return `#${c.getHexString()}`
}

function AreteMesh({ mesh, color, wireframe, roughness, metalness }) {
  const { size, gl } = useThree()
  const lineMatRef = useRef(null)

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3))
    geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
    geo.computeVertexNormals()
    return geo
  }, [mesh])

  const edgeBasic = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(mesh.wire.slice(), 3),
    )
    return geo
  }, [mesh])

  const edgeFat = useMemo(() => {
    const geo = new LineSegmentsGeometry()
    geo.setPositions(Array.from(mesh.wire))
    return geo
  }, [mesh])

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

  return (
    <group>
      {/* Solide : légèrement repoussé dans le Z-buffer (invisible) */}
      <mesh geometry={geometry} castShadow receiveShadow renderOrder={0}>
        <meshStandardMaterial
          color={color}
          roughness={roughness ?? 0.55}
          metalness={metalness ?? 0.05}
          side={THREE.DoubleSide}
          wireframe={wireframe}
          polygonOffset
          polygonOffsetFactor={2}
          polygonOffsetUnits={2}
        />
      </mesh>
      {/* Lignes à la position exacte — depth bias vers la caméra */}
      <lineSegments geometry={edgeBasic} renderOrder={2}>
        <lineBasicMaterial
          color={ARETE_EDGE_COLOR}
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
          color={ARETE_EDGE_COLOR}
          linewidth={ARETE_EDGE_WIDTH}
          transparent={false}
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
    ? shadeHex(finish.color, (surf.shade ?? 1) * 1.08)
    : shadeHex(finish.color, surf.shade ?? 1)

  return (
    <group
      position={position}
      rotation={[0, rotationZ, 0]}
      scale={[SCALE, SCALE, SCALE]}
    >
      <group position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {ossature.meshes.map((m) => (
          <AreteMesh
            key={m.id}
            mesh={m}
            color={color}
            wireframe={wireframe}
            roughness={surf.roughness}
            metalness={Math.max(surf.metalness ?? 0.05, 0.12)}
          />
        ))}
        {selected && (
          <axesHelper args={[Math.max(dims.L, dims.W, dims.H) * 0.35]} />
        )}
      </group>
    </group>
  )
}
