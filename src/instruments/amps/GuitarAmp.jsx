
import React, { Suspense, useMemo, useRef } from 'react'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
export function GuitarAmp(props) {
  const { nodes, materials } = useGLTF('/amps/marshall_amp.glb')
 const lightRef = useRef();
const [ampCol, ampNorm] = useTexture([
  '/amps/textures/marshall1.png',
 '/amps/textures/marshall_normal.png'])

ampCol.flipY = ampNorm.flipY = false

const ampMat = useMemo(() => new THREE.MeshStandardMaterial({map: ampCol, normalMap: ampNorm, roughness : 0.5, metalness: .5, envMapIntensity: .2  }))

  return (

    <group  dispose={null} rotation={props.rotation? props.rotation : [0,-Math.PI*.7,0]}      position={props.position? props.position : [4, 0, 6]} >
          <group position={[-.15,.3,0.583]}>
        <pointLight
          ref={lightRef}
          color={props.color} 
          intensity={0}
          userData={{ intensityMultiplier: 4 }} 
 
          castShadow
          decay={1}
          shadow-camera-far={15}
          shadow-mapSize={[256, 256]}
          />
      </group>
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.horni_box.geometry}
        material={ampMat}
        position={[0.001, 0.005, 0]}
        />
      <mesh
        castShadow
        receiveShadow
        geometry={nodes.hlava.geometry}
        material={ampMat}
        position={[0, 0.782, -0.035]}
        />
    </group>
  )
}

useGLTF.preload('/marshall_amp.glb')
