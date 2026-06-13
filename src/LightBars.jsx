import { useRef, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const _matrix = new THREE.Matrix4();

export default function LightBars({ count = 16, radius = 20, analyser }) {
  const instanceRef = useRef();
  const dataArray = useRef();
  const randomYPositions = useRef([]);

  const cylinderGeometry = useMemo(
    () => new THREE.CylinderGeometry(0.2, 0.2, 45, 16),
    []
  );
  const sharedMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: "black",
      emissive: new THREE.Color().setHSL(0.1, 1, 1),
      emissiveIntensity: 0,
    });
  }, []);

  useEffect(() => {
    return () => {
      cylinderGeometry.dispose();
      sharedMaterial.dispose();
    };
  }, [cylinderGeometry, sharedMaterial]);

  useEffect(() => {
    if (analyser) {
      dataArray.current = new Uint8Array(analyser.frequencyBinCount);
    }
    randomYPositions.current = Array.from({ length: count }, () =>
      Math.random() * 30 + 2
    );
    if (!instanceRef.current) return;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = 12 + randomYPositions.current[i];
      _matrix.setPosition(x, y, z);
      instanceRef.current.setMatrixAt(i, _matrix);
    }
    instanceRef.current.instanceMatrix.needsUpdate = true;
  }, [analyser, count, radius]);

  useFrame(() => {
    if (!analyser || !dataArray.current) return;
    analyser.getByteFrequencyData(dataArray.current);

    const avg =
      dataArray.current.reduce((sum, v) => sum + v, 0) /
      dataArray.current.length /
      255;

    sharedMaterial.emissive.setHSL(0.1 + avg, 1, 1);
    sharedMaterial.emissiveIntensity = avg * 10;
    sharedMaterial.needsUpdate = false;
  });

  return (
    <instancedMesh
      ref={instanceRef}
      args={[cylinderGeometry, sharedMaterial, count]}
    />
  );
}
