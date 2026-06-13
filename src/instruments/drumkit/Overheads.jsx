import React, { forwardRef, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { drumkit } from './drumkitMaterials';
import * as THREE from 'three'
export const Overheads = forwardRef((props, ref) => {
  const { nodes, materials } = useGLTF('/drumkit/Overhead.glb');

  const metalMat = useMemo(() => drumkit.metalMat.clone(), []);
  const padMat = useMemo(() => drumkit.padMat.clone(), []);
  const woodMat = useMemo(() => drumkit.woodMat.clone(), []);

  return (
    <group {...props} dispose={null} scale={1.5}>
      <group position={[0, -.015, -2.35]}>
 
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Torus_1.geometry}
          material={nodes.Torus_1.material}
          material-color={"#000"}
          material-side={THREE.DoubleSide}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Torus_2.geometry}
          material={padMat}
       
        />
      </group>
    </group>
  );
});
useGLTF.preload('/drumkit/Overhead.glb');
