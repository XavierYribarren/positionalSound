# Optimisations appliquées

## 1. LightBars.jsx — InstancedMesh

**Fichier :** `src/LightBars.jsx`

- **Supprimé :** `useState(level)` + `setLevel(avg)` dans `useFrame` (appelait setState chaque frame → re-render → recréation des 24 éléments JSX)
- **Ajouté :** `const _matrix = new THREE.Matrix4()` au niveau module (réutilisé chaque frame sans allocation)
- **Modifié :** `useEffect([analyser, count, radius])` — positionne maintenant chaque instance via `setMatrixAt()` + `instanceMatrix.needsUpdate = true`
- **Remplacé :** Le bloc `Array.from({ length: count }, ...)` retournant 24 `<mesh>` → un seul `<instancedMesh ref={instanceRef} args={[cylinderGeometry, sharedMaterial, count]} />`

**Impact :** 24 draw calls → 1 draw call.

---

## 2. CrashMin.jsx — fix colorspace

**Fichier :** `src/instruments/drumkit/CrashMin.jsx`, lignes 18 et 21

```diff
- cymNormalMap.encoding = THREE.sRGBEncoding;
+ cymNormalMap.colorSpace = THREE.SRGBColorSpace;

- cymEmissiveMap.encoding = THREE.sRGBEncoding;
+ cymEmissiveMap.colorSpace = THREE.SRGBColorSpace;
```

`THREE.sRGBEncoding` retiré de Three.js depuis r152 (remplacé par `THREE.SRGBColorSpace`). Corrige l'erreur de build silencieuse et le colorspace incorrect de la cymbale Crash.

---

## 3. DemoScene.jsx — suppression de `preserveDrawingBuffer`

**Fichier :** `src/DemoScene.jsx`, ancienne ligne 723

```diff
- gl={{ antialias: true, preserveDrawingBuffer: true }}
+ gl={{ antialias: true }}
```

Aucune fonctionnalité de capture canvas trouvée dans le fichier. Flag retiré.

---

## 4. DemoScene.jsx — suppression des imports postprocessing inutilisés

**Fichier :** `src/DemoScene.jsx`, anciennes lignes 35-41

```diff
- import {
-   Bloom,
-   DepthOfField,
-   EffectComposer,
-   GodRays,
-   Noise,
-   Vignette,
- } from '@react-three/postprocessing';
```

`EffectComposer` et ses effets n'apparaissent nulle part dans le JSX de `DemoScene`. Import supprimé.

---

## 5. Overheads.jsx — suppression de `useDepthBuffer`

**Fichier :** `src/instruments/drumkit/Overheads.jsx`, ligne 2

```diff
- import { SpotLight, useDepthBuffer, useGLTF } from '@react-three/drei';
+ import { useGLTF } from '@react-three/drei';
```

`SpotLight` et `useDepthBuffer` non utilisés dans le composant.

---

## 6. Shadow maps limitées sur les pointLights d'instruments

### BassSVTAmp.jsx

**Fichier :** `src/instruments/amps/BassSVTAmp.jsx`, pointLight

```diff
  castShadow
  decay={1.2}
+ shadow-camera-far={15}
+ shadow-mapSize={[256, 256]}
```

Commentaires dead code (`shadow-bias`, `shadow-mapSize-width`, etc.) également retirés.

### GuitarAmp.jsx

**Fichier :** `src/instruments/amps/GuitarAmp.jsx`, pointLight

```diff
  castShadow
  decay={1}
+ shadow-camera-far={15}
+ shadow-mapSize={[256, 256]}
```

Appliqué aux deux instances Guitar (gtr1 et gtr2 partagent le même composant).

### Micro.jsx

**Fichier :** `src/instruments/mics/Micro.jsx`, spotLight

```diff
  distance={50}
+ shadow-camera-far={15}
+ shadow-mapSize={[256, 256]}
```

---

## Résumé impact

| Optimisation | Avant | Après |
|---|---|---|
| Draw calls LightBars | 24 | 1 |
| Re-renders LightBars / frame | 1 (setState) | 0 |
| Build error CrashMin | ✅ sRGBEncoding absent | ✅ SRGBColorSpace correct |
| Shadow cubemap faces/frame (point×4) | 512×512 × 6 faces = 6 MB/light | 256×256 × 6 faces = 1.5 MB/light |
| Shadow far plane pointLights | 500 (défaut) | 15 unités |
| Imports postprocessing (dead) | 6 symboles | 0 |
| preserveDrawingBuffer | true | supprimé |
