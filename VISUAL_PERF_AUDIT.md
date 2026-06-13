# Audit — Performance visuelle & poids des assets 3D

> Mode Demo (`demoMode=true`) — branche `opti` — 2026-06-10

---

## 1. Meshes 3D — inventaire par composant (Demo)

### 1.1 GLB chargés et submesh count

| Composant | GLB | Taille disque | Submeshes | castShadow | receiveShadow | Point/SpotLight interne |
|---|---|---|---|---|---|---|
| `Kick` | `Kick.glb` | **842 KB** | 9 | ✅ tous | ✅ tous | ✗ |
| `HiTom` | `Tom2.glb` | **815 KB** | 6 | ✅ tous | ✅ tous | ✗ |
| `BassSVTAmp` | `bass_svt.glb` | 293 KB | 2 | ✅ | ✅ | `pointLight` (castShadow) |
| `Snare` | `SnareMin.glb` | 85 KB | 4 | ✅ tous | ✅ tous | ✗ (commenté) |
| `Keyboard` | `keyboard_stand.glb` | 156 KB | 8 + 1 circle proc. | ✅ tous | ✅ tous | ✗ |
| `GuitarAmp` ×2 | `marshall_amp.glb` | 130 KB | 2 par instance | ✅ | ✅ | `pointLight` (castShadow) ×2 |
| `MidTom` | `Tom3.glb` | 260 KB | 6 | ✅ tous | ✅ tous | ✗ |
| `FloorTom` | `TomFloor.glb` | 216 KB | 7 | ✅ tous | ✅ tous | ✗ |
| `Overheads` | `Overhead.glb` | 12 KB | 2 | ✅ | ✅ | ✗ |
| `CrashMin` | `CrashMin.glb` | 54 KB | 4 | ✅ tous | 3/4 | ✗ |
| `RideMin` | `RideMin.glb` | 25 KB | 4 | ✅ tous | ✅ tous | ✗ |
| `HihatMin` | `HihatMin.glb` | 64 KB | 4 | ✅ tous | ✅ tous | ✗ |
| `Micro` (voc1) | `mic_stand.glb` | 77 KB | 2 | ✅ | ✅ | `spotLight` (castShadow) |

**Total GLB chargés en Demo : ~3.03 MB** (marshall_amp.glb chargé une fois, partagé par gtr1 et gtr2 via le cache useGLTF)

**Total submeshes : ~63 draw calls / frame** (hors LightBars et floor)

### 1.2 Textures chargées en Demo

| Fichier | Taille disque | Utilisé par | VRAM estimée |
|---|---|---|---|
| `Comb_Comb_Normal.png` | **6.3 MB** | BassSVTAmp | ~16 MB (2k×2k RGB) |
| `Comb_Comb_BaseColor.png` | **4.7 MB** | BassSVTAmp | ~16 MB |
| `Comb_Comb_Roughness.png` | 1.9 MB | BassSVTAmp | ~4 MB |
| `marshall1.png` | 3.0 MB | GuitarAmp ×2 | ~8 MB |
| `marshall_normal.png` | 3.0 MB | GuitarAmp ×2 | ~8 MB |
| `floor_Dif-min.png` | 2.1 MB | EnvComp (repeat×50) | ~8 MB |
| `floor_Rough-min.png` | 857 KB | EnvComp | ~4 MB |
| `Stage_Floor_001_basecolor.jpg` | 165 KB | EnvComp | ~2 MB |
| `Stage_Floor_001_normal.jpg` | 63 KB | EnvComp | ~2 MB |
| `Stage_Floor_001_ambientOcclusion.jpg` | 52 KB | EnvComp | ~1 MB |
| `cym_normals.png` | 459 KB | Hihat, Crash, Ride (×3 instances) | ~4 MB (partagée) |
| `cym_EmissiveMap.png` | 74 KB | Hihat, Crash, Ride | ~1 MB |
| `keyboard_graphics.png` | 79 KB | Keyboard | ~1 MB |
| `keysoft-min.png` | 57 KB | Keyboard (alpha) | ~1 MB |
| `Comb_Comb_Metallic.png` | 86 KB | BassSVTAmp | ~1 MB |

**Total textures sur disque (Demo) : ~22.9 MB PNG/JPG**
**VRAM textures estimée : ~77 MB** (après décompression GPU, sans mip-maps)

> ⚠️ Les textures PNG ne sont pas compressées GPU (pas de KTX2/Basis). Chaque PNG est décompressé en RGBA brut lors de l'upload WebGL.

### 1.3 Géométries procédurales

| Composant | Géométrie | Remarque |
|---|---|---|
| `Keyboard` | `<circleGeometry args={[2, 64]} />` | 64 segments — inline dans le JSX, recréé si Keyboard démonte |
| `LightBars` | `CylinderGeometry(0.2, 0.2, 45, 16)` | Partagée via `useMemo` ✅ |
| `EnvComp` | `<planeGeometry args={[100, 100]} />` | Via JSX — géré par R3F |

### 1.4 castShadow / receiveShadow

**Tous les submeshes (63) ont `castShadow` activé.** Cela inclut des pièces de kit très géométriquement complexes (Kick : 9 submeshes, Tom2 : 6 submeshes). C'est le principal facteur de coût en rendu.

Aucun mesh n'est rendu avec `visible={false}` côté 3D en mode Demo (les flags `visible` Redux pilotent la visibilité via `visibleMap` passé à ObjSound, mais le rendu Three.js lui-même n'est pas conditionné — seule l'émissivité change).

---

## 2. Scène Demo — analyse spécifique

### 2.1 Meshes spawnés

`DEMO_MESHES` contient **14 entrées** :

```
9 pièces de drumkit : Snare, Kick, Hihat, HiTom, MidTom, FloorTom, Crash, Ride, Overheads
2 guitares (même GLB, 2 instances)
1 basse SVT
1 clavier
1 micro vocal
```

Chacune est wrappée dans un `<group scale={5}>` par `ObjSound`. Scale 5 sur tous les instruments.

### 2.2 Lumières et shadow passes

| Lumière | Composant | castShadow | Shadow passes / frame |
|---|---|---|---|
| `pointLight` | `EnvComp` | ✅ | 6 (cubemap) |
| `pointLight` | `BassSVTAmp` (bass1) | ✅ | 6 |
| `pointLight` | `GuitarAmp` (gtr1) | ✅ | 6 |
| `pointLight` | `GuitarAmp` (gtr2) | ✅ | 6 |
| `spotLight` | `Micro` (voc1) | ✅ | 1 |

**Total : 25 shadow passes par frame**, chacune rendant les ~63 meshes castShadow.

Type de shadow map : `PCFSoftShadowMap` (le plus coûteux disponible).

> ⚠️ Chaque `pointLight` avec `castShadow` nécessite 6 renders de shadow cubemap. Avec 4 pointLights, c'est 24 passes supplémentaires par frame — chacune traversant l'intégralité du scene graph.

### 2.3 LightBars — instanced ou 24 draw calls ?

**24 draw calls séparés**, pas d'`InstancedMesh`.

```jsx
// LightBars.jsx — rendu actuel
{Array.from({ length: count }, (_, i) => (
  <mesh
    key={i}
    geometry={cylinderGeometry}  // ← même ref géométrie
    material={sharedMaterial}    // ← même ref matériau
    position={[x, 12 + y, z]}
  />
))}
```

Geometry et material sont partagés (useMemo), mais R3F/Three.js n'auto-merge pas les draw calls. Chaque `<mesh>` est un draw call distinct.

Avec `THREE.InstancedMesh`, les 24 cylindres seraient **1 draw call**.

### 2.4 `useDepthBuffer` importé mais inutilisé

`Overheads.jsx` importe `SpotLight, useDepthBuffer` depuis `@react-three/drei` sans les utiliser. `useDepthBuffer` crée un render target supplémentaire (depth pass). Si le module est exécuté (même sans être appelé dans le JSX), il peut allouer des ressources GPU selon la version de Drei.

---

## 3. Shaders & postprocessing

### 3.1 ShaderMaterial actifs en mode Demo

| Composant | ShaderMaterial | Uniforms dynamiques |
|---|---|---|
| `FrequencyFloor` | ✅ (`uPointSize`, `uSprite`) | Mis à jour dans `useFrame` |
| `FrequencySpectrum` | ✅ (`uPointSize`, `uSprite`) | Mis à jour dans `useFrame` |

`FrequencySpectrum` est présent dans `SceneContents.jsx` mais commenté en mode Demo :
```jsx
{/* <FrequencySpectrum sources={sourcesForFloor} playing={playing} maxHeight={15} /> */}
```
→ Actif uniquement si décommenté.

### 3.2 Postprocessing (@react-three/postprocessing)

Importé dans `DemoScene.jsx` (lignes 35-41) : `EffectComposer`, `Bloom`, `Noise`, `Vignette`.

**Non rendu dans le JSX** — aucun `<EffectComposer>` présent dans le Canvas de DemoScene. Ces imports augmentent le bundle JS sans contribution visuelle.

### 3.3 Options Canvas coûteuses

```jsx
// DemoScene.jsx:721-726
dpr={[1, 2]}                      // ← jusqu'à 4× les pixels sur retina
gl={{ antialias: true,            // ← MSAA activé
      preserveDrawingBuffer: true }} // ← ⚠️ empêche les optimisations driver GPU
gl.shadowMap.type = THREE.PCFSoftShadowMap  // ← filtre le plus coûteux
```

`preserveDrawingBuffer: true` désactive une optimisation clé : le GPU ne peut plus réutiliser le framebuffer entre les frames. C'est nécessaire pour les captures d'écran WebGL, mais a un impact mesurable sur les GPU mobiles.

---

## 4. Bundle JS

```
dist/assets/index-CMW1SKvb.js   1 664 KB  │  gzip: 502 KB
```

**Un seul chunk — zéro code splitting.**

1667 modules dans un seul bundle : Three.js, R3F, Drei, Redux Toolkit, dnd-kit, MUI, postprocessing, etc. Tout est chargé et parsé avant que la première frame soit affichée.

**Erreur build dans CrashMin.jsx :**
```
"sRGBEncoding" is not exported by three.module.js
```
`THREE.sRGBEncoding` est retiré depuis Three.js r152 (remplacé par `THREE.SRGBColorSpace`). Le projet utilise Three.js `^0.177.0`. Le build passe quand même mais le texture encoding n'est pas appliqué sur la cymbale Crash → couleur potentiellement incorrecte à l'écran.

### Chunks identifiés

| Asset | Taille | Commentaire |
|---|---|---|
| `index.js` | 1 664 KB (502 KB gz) | Tout le JS bundlé |
| `index.css` | 12 KB (3.4 KB gz) | CSS OK |
| `MusicroomRender-min.png` | 531 KB | Image de fond Intro, dans le bundle |

---

## 5. Assets publics non utilisés en Demo

Ces GLB sont dans `public/` mais ne sont **jamais chargés** en mode Demo :

| Fichier | Taille | Statut |
|---|---|---|
| `drumkit/Snare.glb` | **2.1 MB** | Remplacé par SnareMin.glb |
| `drumkit/Hihat.glb` | **1.1 MB** | Remplacé par HihatMin.glb |
| `compressed.glb` | 827 KB | Inconnu — potentiellement un test |
| `drumkitpartedOPT.glb` | 769 KB | Vestige |
| `drumkitOPT.glb` | 737 KB | Vestige |
| `drumkit/Ride.glb` | 509 KB | Remplacé par RideMin.glb |
| `drumkit/stool.glb` | 422 KB | Non référencé |
| `drumkit/Crash.glb` | 487 KB | Remplacé par CrashMin.glb |
| `scene-draco.glb` | 356 KB | Vestige |
| `amps/bass_amp.glb` | 149 KB | Non utilisé |
| `drumLP.glb` | 88 KB | Vestige |
| `BassPosi.glb` | 56 KB | Vestige |

**Total : ~7.6 MB de GLB orphelins** dans le dossier public.

---

## 6. Recommandations — par impact décroissant

### 🔴 Critique

**6.1 Shadow-casting lights : réduire de 5 → 1**
Les 4 pointLights dans BassSVTAmp et GuitarAmp×2 avec `castShadow` génèrent 24 passes cubemap supplémentaires par frame. Ces lumières ont `intensity={0}` au repos et ne sont visibles que lors des pics audio — leurs shadows ne sont pas perceptibles à l'oreille.
→ Retirer `castShadow` des pointLights d'instruments. Conserver uniquement `EnvComp.pointLight`.
→ **Impact : -24 shadow passes / frame.**

**6.2 LightBars → InstancedMesh**
24 draw calls → 1.
```jsx
// Remplacer le Array.from par un InstancedMesh
const instancedRef = useRef();
// setMatrixAt() dans useFrame pour positionner chaque cylindre
<instancedMesh ref={instancedRef} args={[cylinderGeometry, sharedMaterial, count]} />
```
→ **Impact : -23 draw calls / frame.**

**6.3 Compresser les textures en KTX2/Basis**
Le Normal SVT Amp (6.3 MB PNG → ~16 MB VRAM) et les marshall textures (6 MB PNG → ~16 MB VRAM) représentent la majorité de la VRAM texture. Avec KTX2 (format GPU natif) :
- Taille fichier : -60% (streaming possible)
- VRAM : -75% (stockage compressé GPU ETC2/BC7)
- Outil : `npx @gltf-transform/cli optimize --texture-compress ktx2`
→ **Impact : VRAM textures ~77 MB → ~20 MB.**

### 🟠 Important

**6.4 Corriger `THREE.sRGBEncoding` → `THREE.SRGBColorSpace` dans CrashMin.jsx**
Erreur de build silencieuse — la cymbale Crash s'affiche avec le mauvais colorspace.
```js
// CrashMin.jsx
// Avant
cymNormalMap.encoding = THREE.sRGBEncoding;
// Après
cymNormalMap.colorSpace = THREE.SRGBColorSpace;
```

**6.5 Supprimer les imports postprocessing inutilisés**
`EffectComposer`, `Bloom`, `Noise`, `Vignette` importés mais non rendus dans DemoScene → dead code dans le bundle.
→ Supprimer ou déplacer dans un fichier lazy-loadé si l'usage est futur.

**6.6 Retirer `preserveDrawingBuffer: true`**
Sauf si une fonctionnalité de capture d'écran canvas est active, ce flag pénalise les perfs GPU (surtout mobile).

**6.7 Code splitting du bundle**
```js
// vite.config.js
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'three':    ['three'],
        'r3f':      ['@react-three/fiber', '@react-three/drei'],
        'redux':    ['@reduxjs/toolkit', 'react-redux'],
        'ui':       ['@mui/material', '@dnd-kit/core', '@dnd-kit/sortable'],
      }
    }
  }
}
```
→ Le chunk principal passerait de 1 664 KB à ~200-300 KB, avec lazy-loading des dépendances Three.js.

### 🟡 Moyen terme

**6.8 LOD sur les toms (Tom2.glb : 815 KB)**
Tom2.glb et Kick.glb cumulent ~1.65 MB et sont très détaillés pour des meshes vus de loin. Utiliser `<Lod>` de Drei ou simplifier les GLB avec gltf-transform.

**6.9 `dpr` max à 1.5 sur mobile**
```jsx
dpr={[1, isMobile ? 1.5 : 2]}
```
Sur mobile, dpr=2 quadruple le pixel count par rapport à dpr=1.

**6.10 Nettoyer les GLB orphelins**
7.6 MB de fichiers non référencés dans `public/` — ne coûtent rien à runtime mais alourdissent les déploiements.

**6.11 `useDepthBuffer` dans Overheads.jsx**
Import non utilisé — à supprimer pour éviter une allocation GPU potentielle.

---

## 7. Tableau récapitulatif

| Métrique | Valeur actuelle | Objectif raisonnable |
|---|---|---|
| Draw calls / frame | ~90 (63 meshes + 24 LightBars + floor) | ~50 (-23 LightBars instancing) |
| Shadow passes / frame | 25 | 1 (garder EnvComp uniquement) |
| GLB chargés en Demo | ~3.03 MB | ~3.03 MB (déjà optimisés Min) |
| Textures VRAM | ~77 MB | ~20 MB (KTX2) |
| Bundle JS | 1 664 KB (502 gz) | ~300 KB + chunks lazy |
| Textures disque | 22.9 MB | ~8 MB (KTX2 + jpg quality) |
