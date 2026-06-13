# Performance Audit — positionalSound

> Audit réalisé le 2026-06-09 sur la branche `opti`.

---

## 1. Re-renders React inutiles

### 1.1 Composants sans `React.memo`

| Composant | Problème | Recommandation |
|---|---|---|
| `SortableTrackRow` (TrackConsole.jsx:31) | Re-render à chaque changement de `trackList` parent, même si les props de la ligne n'ont pas changé | Wrapper avec `React.memo(SortableTrackRow, (prev, next) => prev.track === next.track && prev.settings === next.settings && prev.assignments === next.assignments)` |
| `SoundParticles.jsx` | Pas de memo ; ré-évalue à chaque frame R3F si le parent re-rend | `React.memo` |
| `LightBars.jsx` | Même cas | `React.memo` |
| `FrequencyFloor.jsx` / `FrequencySpectrum.jsx` | Composants lourds (BufferGeometry + ShaderMaterial) sans memo | `React.memo` |

`SceneContents` utilise déjà `React.memo` — ✅

### 1.2 Handlers inline non stabilisés

**TrackConsole.jsx:105-109** — `onChange` du `Slider` crée une nouvelle fonction à chaque render :
```jsx
// Avant
onChange={(e, value) => {
  dispatch(setVolume({ trackId: track.id, volume: value }));
}}

// Après (dans SortableTrackRow)
const handleVolumeChange = useCallback(
  (_, value) => dispatch(setVolume({ trackId: track.id, volume: value })),
  [dispatch, track.id]
);
```

**SceneContents.jsx** — `onMainEnded` passé inline à chaque `<Sound>` :
```jsx
// Chaque rendu recréée la fonction pour chaque piste
onMainEnded={() => { setPauseTime(0); setPlayOffset(0); setPlaying(false); setUiVisible(true) }}
```
→ Stabiliser avec `useCallback` au niveau du parent, puis passer la référence stable.

**App.jsx:382-398** — Le listener clavier est re-enregistré dès que `playing` change car `playAll`/`pauseAll` ne sont pas mémorisés :
```js
useEffect(() => {
  const handler = (e) => { ... };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [playing, playAll, pauseAll]); // playAll/pauseAll recréés → re-register inutile
```
→ Stabiliser `playAll` et `pauseAll` avec `useCallback`.

### 1.3 `useMemo` manquant ou incomplet

**SceneContents.jsx:47-51** — `syncedSubs` mapping sans tableau de dépendances :
```js
// Avant
const syncedSubs = useMemo(() => subs.map(...));

// Après
const syncedSubs = useMemo(() => subs.map(...), [subs, settings]);
```
Sans dépendances, React recalcule à chaque render — l'optimisation est annulée.

**App.jsx:538-588** — `canvasProps` est un `useMemo` avec 32 dépendances dont certaines (handlers) sont instables. Extraire les sous-groupes en useMemo séparés ou stabiliser les handlers référencés dedans.

---

## 2. Gestion mémoire Three.js — `dispose` manquants

### 2.1 Fuites confirmées

| Fichier | Objet Three.js | dispose appelé ? |
|---|---|---|
| `FrequencyFloor.jsx:91` | `THREE.BufferGeometry` | ❌ |
| `FrequencyFloor.jsx:99` | `THREE.ShaderMaterial` | ❌ |
| `FrequencySpectrum.jsx:107` | `THREE.BufferGeometry` | ❌ |
| `FrequencySpectrum.jsx:118` | `THREE.ShaderMaterial` | ❌ |
| `SoundParticles.jsx:111` | `THREE.PlaneGeometry` | ❌ |
| `SoundParticles.jsx:112` | `THREE.MeshBasicMaterial` | ❌ |
| `EnvComp.jsx:31` | `THREE.MeshStandardMaterial` | ❌ |

`LightBars.jsx` est le seul composant qui dispose correctement (lines 26-31) — ✅

### 2.2 Pattern à appliquer

```js
// Exemple pour FrequencyFloor.jsx
const geometry = useMemo(() => {
  const geo = new THREE.BufferGeometry();
  // ... setup ...
  return geo;
}, []);

useEffect(() => {
  return () => {
    geometry.dispose();
    material.dispose();
    // pour les textures : texture.dispose()
  };
}, [geometry, material]);
```

### 2.3 Textures canvas (IIFE)

`FrequencyFloor.jsx:9-21` et `FrequencySpectrum.jsx:8-20` créent chacun une texture canvas via un IIFE au module-level. Ces textures ne sont jamais disposées. Comme elles sont globales, elles persistent pour toute la durée de vie de la page — acceptable si les composants ne sont montés/démontés qu'une fois, mais à surveiller si le routing monte/démonte ces composants.

---

## 3. Cycle de vie des Web Audio nodes

### 3.1 Fuites potentielles dans `Sound.jsx`

La fonction `stopAndCleanupAll` (lines 74-114) est correctement câblée et couvre tous les nodes (`positionalSrcRef`, `threeAudioRef`, `gainRef`, `sendGainRef`, `stereoPannerRef`, etc.). Le nettoyage appelle `disconnect()` et `stop()` dans des blocs try/catch — ✅

**Point de vigilance :** `sendGainRef` (ligne 181) et le second `BufferSource` pour le send (ligne 185) sont créés sans être stockés dans une ref nommée séparée. Si `stopAndCleanupAll` est appelée avant que ces nodes soient connectés, ils restent actifs. Vérifier que tous les nodes créés ont une ref correspondante dans le cleanup.

### 3.2 Dépendances manquantes dans `Sound.jsx:273-285`

L'effet principal de playback liste `pauseTime` comme dépendance, ce qui déclenche un re-setup complet du graph audio à chaque pause. `playOffset` n'est pas dans les dépendances alors qu'il est utilisé à la ligne 130.

```js
// Dépendances actuelles (résumé)
[on, paused, buffer, listener, convolver, playStartTime, pauseTime, dist, masterTapGain, meshRef, trackId]
// → Ajouter playOffset
// → Envisager de séparer l'effet "setup du graph" de l'effet "start/stop"
```

### 3.3 Graph audio App.jsx — re-câblage sur chaque changement de deps

`useEffect` (App.jsx:150-204) recrée et recâble l'intégralité du graph reverb (splitter, delays, merger, filters, convolver, reverbGain) si l'une des 6 dépendances change. Ces nodes sont créés avec `useMemo` donc stables, mais le `fetch` de l'IR est relancé à chaque changement de `convolver` — or `convolver` est lui-même dans le `useMemo` du même effet. À vérifier : si `audioCtx` change (context recreated), tous les nodes devront être recréés — c'est probablement intentionnel mais pourrait être clarifié.

---

## 4. Cohérence Redux vs Valtio

### 4.1 Répartition actuelle

| État | Store | Justification |
|---|---|---|
| Volume, pan, sendLevel, couleur, visibilité par piste | Redux (`trackSettingsSlice`) | ✅ — état UI partagé, sérialisable, besoin de sélecteurs cross-composants |
| Mode de vue ('stageMode' / 'visualizerMode') | Redux (`viewModeSlice`) | ✅ — simple flag, cohérent |
| Positions presets | Redux (`positionsSlice`) | ⚠️ — aucun `dispatch` trouvé dans le code ; ce slice semble inactif |
| Objet 3D sélectionné + mode transform | Valtio (`sceneState`) | ✅ — état d'interaction locale à la scène 3D, mutation directe appropriée |

### 4.2 Ce qui pourrait migrer

- **`positionsSlice`** : aucun dispatch visible → soit le supprimer, soit confirmer son usage. S'il sert uniquement à pré-peupler des positions fixes, une simple constante suffit.
- **`viewModeSlice`** : un seul composant (`EnvComp`) le lit, aucun dispatch visible dans le reste de l'app (à vérifier). Si c'est le cas, un état Valtio local ou même un prop serait plus léger que Redux pour un flag aussi simple.
- Pas de pollution croisée constatée : les composants Three.js (R3F) n'accèdent pas à Redux directement sauf `SceneContents` qui mappe `settings` vers des props — c'est le bon pattern.

---

## 5. Shaders GLSL

### 5.1 Uniforms et recompilations

Les deux `ShaderMaterial` (`FrequencyFloor.jsx` et `FrequencySpectrum.jsx`) sont créés une seule fois via `useMemo` — aucune recompilation à chaque render ✅.

Les uniforms mis à jour dans `useFrame` :
- `uPointSize` — valeur numérique scalaire, mise à jour directe sur `material.uniforms.uPointSize.value` ✅
- `uSprite` — texture canvas, créée une seule fois via IIFE, jamais réassignée ✅

Les attributs mis à jour chaque frame :
```js
// FrequencyFloor.jsx:155-158
posAttr.needsUpdate = true;
colorAttr.needsUpdate = true;
opacityAttr.needsUpdate = true;
```
C'est correct pour un système de particules dynamique. Pas de recompilation shader détectée.

### 5.2 Optimisations possibles

- `precision mediump float` est déjà utilisé dans le fragment shader — ✅ bon choix pour les particules.
- Les shaders pourraient bénéficier de `glslify` ou d'un système de cache de programmes si d'autres ShaderMaterial avec le même source étaient ajoutés. Pas de doublon actuellement.
- `depthWrite: false` sur les deux matériaux de particules — ✅ correct pour le rendu transparent additif.

---

## 6. dnd-kit — event listeners

### 6.1 Configuration actuelle

```jsx
// TrackConsole.jsx:274-278
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
);
```
`useSensors` et `useSensor` sont stables entre renders si les options ne changent pas — ✅ (les options sont un objet littéral mais dnd-kit les compare par valeur en interne).

### 6.2 Problèmes identifiés

**`items` recréé à chaque render (TrackConsole.jsx) :**
```jsx
// Avant — nouvel array à chaque render
<SortableContext items={trackList.map((t) => t.id)} strategy={verticalListSortingStrategy}>

// Après
const sortableIds = useMemo(() => trackList.map((t) => t.id), [trackList]);
<SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
```

**`handleDragEnd` non mémorisé :**
```jsx
// Avant
function handleDragEnd({ active, over }) { ... }

// Après
const handleDragEnd = useCallback(({ active, over }) => { ... }, [trackList]);
```
Sans mémoïsation, `DndContext` reçoit une nouvelle référence à chaque render, forçant un re-register interne des listeners de pointeur.

**Listeners `{...attributes} {...listeners}` sur le drag handle :** correctement scopés au `div.drag-handle` — ✅ pas de pollution sur l'élément parent.

---

## 7. Résumé prioritaire

| Priorité | Problème | Impact | Fichier(s) |
|---|---|---|---|
| 🔴 CRITIQUE | `dispose()` manquant sur 7 objets Three.js | Fuite GPU — VRAM non libérée sur unmount | FrequencyFloor, FrequencySpectrum, SoundParticles, EnvComp |
| 🔴 CRITIQUE | `console.log(tracks)` dans le corps de `Scene` | Sérialise l'intégralité du state à chaque frame R3F | Scene.jsx (**supprimé**) |
| 🟠 IMPORTANT | `useMemo` sans dépendances dans `SceneContents` | `syncedSubs` recalculé à chaque render | SceneContents.jsx:47 |
| 🟠 IMPORTANT | `SortableTrackRow` sans `React.memo` | Re-render de toutes les lignes quand une seule change | TrackConsole.jsx:31 |
| 🟠 IMPORTANT | Handlers inline dans `SortableTrackRow` | Nouvelles fonctions à chaque render, invalide memo | TrackConsole.jsx:105-109, 119, 128, 152… |
| 🟡 MOYEN | `sortableIds` recréé inline dans `SortableContext` | Re-register dnd-kit listeners | TrackConsole.jsx |
| 🟡 MOYEN | `playAll`/`pauseAll` instables → re-register keydown | Listener re-attached sur chaque changement de `playing` | App.jsx:382-398 |
| 🟡 MOYEN | `positionsSlice` Redux inutilisé | Code mort dans le store | reducer/positionsSlice.js |
| 🟢 MINEUR | Textures canvas IIFE sans dispose | Fuite si composant monté/démonté plusieurs fois | FrequencyFloor.jsx, FrequencySpectrum.jsx |
| 🟢 MINEUR | `viewModeSlice` avec un seul lecteur | Redux superflu pour un flag binaire | reducer/viewModeSlice.js |

---

## 8. Console.log supprimés

Les lignes suivantes ont été supprimées dans ce commit :

| Fichier | Type | Description |
|---|---|---|
| `Scene.jsx:39` | `console.log` | `tracks` loggué à chaque frame R3F |
| `Scene.jsx:67` | `console.log` | `'CLICK'` dans onClick de ObjSound |
| `TrackConsole.jsx:107` | `console.log` | Valeur du slider volume |
| `Intro.jsx:42` | `console.log` | `isMobile` |
| `MasterControls.jsx:41` | `console.log` | Référence `masterGain` |
| `DemoScene.jsx:684-687` | `console.log` | État de chargement des buffers |
| `DemoScene.jsx:444` | `console.warn` | Fullscreen API failure |
| `DemoScene.jsx:450` | `console.warn` | Orientation lock failure |
| `DemoScene.jsx:378` | `console.error` | IR load error |
| `App.jsx:196` | `console.error` | IR load error |
| `App.jsx:476` | `console.warn` | Stop source node failure |
| `Waveform.jsx:44` | `console.error` | Waveform draw error |
