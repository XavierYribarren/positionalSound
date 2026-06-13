# MusicRoom — positionalSound

Application web de scène musicale 3D avec audio positionnel (Web Audio API + Three.js).
Permet de placer des instruments 3D dans un espace, d'y assigner des pistes audio, et d'écouter le mix en 3D depuis la position de la caméra.

---

## Tech stack

| Couche | Lib |
|---|---|
| 3D / rendu | Three.js via `@react-three/fiber` + `@react-three/drei` |
| UI | React 18, MUI (Slider), react-router-dom |
| Drag & drop | dnd-kit |
| État global | Redux Toolkit (`trackSettings`, `viewMode`) + Valtio (`sceneState`) |
| Audio | Web Audio API, `THREE.PositionalAudio`, `THREE.AudioListener` |
| Shaders | GLSL via `vite-plugin-glsl` |
| Tests | Vitest (`npm install -D vitest` requis — pas encore dans package.json) |

---

## Architecture état global

**Redux** — état sérialisable partagé entre UI et scène :
- `trackSettingsSlice` : volume, pan, sendLevel, couleur, visibilité par piste
- `viewModeSlice` : `'stageMode'` / `'visualizerMode'`
- `positionsSlice` : presets de positions — **actuellement inutilisé** (aucun dispatch trouvé)

**Valtio** (`src/utils/sceneState.js`) — état d'interaction 3D local :
- `sceneState.current` : nom de l'objet sélectionné
- `sceneState.mode` : index du mode TransformControls (0=translate, 1=rotate)

## Architecture audio spatial

Chemin mesh → PannerNode (voir `AUDIO_SPATIAL_AUDIT.md` pour le détail) :

```
ObjSound (ObjControls.jsx)
  outerRef → passé comme meshRef à <Sound>

Sound.jsx — deux mécanismes :
  1. useEffect setup  (ligne 147-149) : snapshot getWorldPosition → threeAudio.position
  2. useFrame continu (ligne 347-351) : getWorldPosition → threeAudio.position chaque frame

THREE.PositionalAudio.updateMatrixWorld()
  → panner.positionX/Y/Z.value (appelé par R3F dans le même tick)

Thread audio (~2.9 ms de latence, indépendant des frames visuelles)
```

**Risque documenté** : lors d'un scrub de timeline, le snapshot `useEffect` peut lire une position stale si un futur système d'animation repositionne le mesh dans son propre `useFrame`. Le `useFrame` de Sound corrige à la frame suivante (pop spatial d'1 frame). Mitigation recommandée dans `AUDIO_SPATIAL_AUDIT.md`.

---

## Structure src/

```
src/
├── App.jsx                  — état principal : meshes[], trackList, assignments, graph audio
├── DemoScene.jsx            — scène démo (piste "Your Expectations"), mode fullscreen mobile
├── SceneContents.jsx        — boucle sur meshes[], rend les <ObjSound>
├── ObjControls.jsx          — ObjSound (mesh 3D + audio) + Controls (TransformControls/Orbit)
├── Sound.jsx                — nœud audio positionnel, toute la logique Web Audio
├── TrackConsole.jsx         — UI console (dnd-kit), Redux pour volume/pan/couleur
├── MeshSpawner.jsx          — boutons de spawn d'instruments
├── FrequencyFloor.jsx       — ShaderMaterial, particules réactives à l'audio
├── FrequencySpectrum.jsx    — idem
├── animation/
│   ├── keyframeUtils.js     — interpolation de keyframes, applyPositionToPanner (NOUVEAU)
│   └── __tests__/           — tests Vitest (NOUVEAU)
├── reducer/
│   ├── store.js
│   ├── trackSettingsSlice.js
│   ├── viewModeSlice.js
│   └── positionsSlice.js    — inutilisé, à supprimer ou activer
├── utils/
│   └── sceneState.js        — proxy Valtio
└── shaders/
    ├── FrequencyFloor-vert.glsl
    └── FrequencyFloor-frag.glsl
```

---

## Fichiers d'audit (ne pas supprimer)

| Fichier | Contenu |
|---|---|
| `PERF_AUDIT.md` | État des lieux perf complet : re-renders, dispose Three.js, Web Audio, Redux/Valtio, shaders, dnd-kit |
| `AUDIO_SPATIAL_AUDIT.md` | Audit couplage position mesh ↔ PannerNode, risques de désync, recommandations |
| `outputs/context_for_audit.zip` | Snapshot des fichiers clés (App.jsx, ObjControls, SceneContents, positionsSlice, sceneState, MeshSpawner) |

---

## Issues prioritaires (issues de PERF_AUDIT.md)

| Priorité | Problème | Fichier(s) |
|---|---|---|
| 🔴 | `dispose()` manquant sur 7 objets Three.js → fuite VRAM | FrequencyFloor, FrequencySpectrum, SoundParticles, EnvComp |
| 🟠 | `useMemo` sans dépendances dans SceneContents (syncedSubs) | SceneContents.jsx:47 |
| 🟠 | `SortableTrackRow` sans `React.memo` | TrackConsole.jsx:31 |
| 🟠 | Handlers inline non stabilisés dans SortableTrackRow | TrackConsole.jsx |
| 🟡 | `positionsSlice` Redux mort (aucun dispatch) | reducer/positionsSlice.js |
| 🟡 | Listeners clavier re-enregistrés à chaque changement de `playing` | App.jsx:382-398 |

---

## Tests

```bash
# Installation (une seule fois)
npm install -D vitest

# Lancer les tests
npx vitest run

# Mode watch
npx vitest
```

Tests dans `src/animation/__tests__/` :
- `keyframeUtils.test.js` — interpolation de keyframes (17 cas)
- `pannerSync.test.js` — position mesh → PannerNode (14 cas)

---

## Branches

- `main` — branche principale
- `opti` — branche de travail courante (audit perf + nettoyage console.log)
