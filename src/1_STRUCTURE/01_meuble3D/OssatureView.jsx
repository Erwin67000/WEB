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
 * Rendu des 12 arêtes d'un meuble Philae.
 * Coordonnées en mm → scale 0.001 vers mètres Three.js.
 * Contours : noir brillant (toujours), un peu épaissis (LineSegments2).
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

  /** Contour filaire classique (fiable, noir) */
  const edgeBasic = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(mesh.wire, 3))
    return geo
  }, [mesh])

  /** Contour épais (Line2) — résolution écran mise à jour */
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
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={color}
          roughness={roughness ?? 0.55}
          metalness={metalness ?? 0.05}
          side={THREE.DoubleSide}
          wireframe={wireframe}
        />
      </mesh>
      {/* Base noire toujours visible (comme vignettes boutique) */}
      <lineSegments geometry={edgeBasic} renderOrder={2}>
        <lineBasicMaterial
          color={ARETE_EDGE_COLOR}
          depthTest
          transparent={false}
        />
      </lineSegments>
      {/* Surcouche légèrement plus épaisse */}
      <lineSegments2 geometry={edgeFat} renderOrder={3}>
        <lineMaterial
          ref={lineMatRef}
          color={ARETE_EDGE_COLOR}
          linewidth={ARETE_EDGE_WIDTH}
          transparent={false}
          depthTest
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

  // Sélection : teinte un peu plus claire sur le volume, arêtes restent noires
  const color = selected
    ? shadeHex(finish.color, (surf.shade ?? 1) * 1.08)
    : shadeHex(finish.color, surf.shade ?? 1)

  return (
    <group
      position={position}
      rotation={[0, rotationZ, 0]}
      scale={[SCALE, SCALE, SCALE]}
    >
      {/*
        Origine meuble fixée (0,0,0) : en changeant L ou W, le repère reste
        en place et le volume s’allonge uniquement vers +X / +Y meuble.
        (plus de centrage −L/2 / +W/2)
      */}
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
