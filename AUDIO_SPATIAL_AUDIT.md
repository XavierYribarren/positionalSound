# Audit : couplage position 3D ↔ PannerNode Web Audio

> Audit réalisé sur la branche `opti` — fichiers lus : `Sound.jsx`, `ObjControls.jsx`, `SceneContents.jsx`.

---

## 1. Où et comment la position du mesh est lue et transmise au PannerNode

### Chemin de données complet

```
ObjSound (ObjControls.jsx:130)
  outerRef ──► <group name={name} scale={5}>
                └── children[0]  ← <Part /> (l'instrument visuel)

Sound.jsx reçoit meshRef = outerRef

A) setup (useEffect, line 147-149) :
   meshRef.current.children[0].getWorldPosition(pos)
   → threeAudio.position.copy(pos)           ← position initiale au moment du mount

B) useFrame (line 347-351) — chaque frame :
   meshRef.current.children[0].getWorldPosition(pos)
   → threeAudioRef.current.position.copy(pos) ← tracking continu

C) THREE.PositionalAudio.updateMatrixWorld()  ← appelé par R3F dans le même tick
   → panner.positionX.value = worldMatrix[12]
   → panner.positionY.value = worldMatrix[13]
   → panner.positionZ.value = worldMatrix[14]

D) Thread audio Web Audio lit ces AudioParams
   lors du prochain buffer (~128 samples ≈ 2.9 ms à 44 100 Hz)
```

### Ce que lit exactement le code

`meshRef.current` est le `<group name={name}>` (outerRef dans ObjSound).  
`meshRef.current.children[0]` est le groupe visuel de l'instrument (`<Part />`).

Le `TransformControls` dans `Controls()` agit sur `scene.getObjectByName(snap.current).children[0]` — **le même objet**. Déplacer un mesh via TransformControls se répercute donc automatiquement dans le `useFrame` de Sound.

---

## 2. Mécanismes utilisés

Deux mécanismes **complémentaires** coexistent dans Sound.jsx :

| Mécanisme | Ligne | Déclencheur | Rôle |
|---|---|---|---|
| `useEffect` (setup) | 147–149 | Changement de `on`, `paused`, `pauseTime`, `playStartTime`, `meshRef`… | Snapshot de position lors de la création du node |
| `useFrame` (continu) | 347–351 | Chaque frame R3F | Tracking continu — corrige tout décalage introduit au setup |

La ref `threeAudioRef` fait le pont entre les deux : l'effet la peuple, `useFrame` la met à jour.

**Point clé :** `threeAudio.position.copy(pos)` dans `useFrame` ne touche pas directement `panner.positionX.value`. La propagation passe par `THREE.PositionalAudio.updateMatrixWorld()`, que R3F appelle via `renderer.render(scene, camera)` dans le même tick que `useFrame`. Le décalage effectif entre la copie de position et la lecture par le thread audio est donc < 1 frame visuelle (< 16 ms à 60 fps).

---

## 3. Scrub de timeline vs animation interpolée

### Scrub (changement brutal de `pauseTime`)

Un changement de `pauseTime` déclenche l'`useEffect` principal (lignes 120–285) :

```
1. stopAndCleanupAll()            — anciens nodes détruits
2. new THREE.PositionalAudio()    — nouveau node créé
3. meshRef.current.children[0]
     .getWorldPosition(pos)       — position lue UNE FOIS,
                                    au moment de l'exécution React
4. threeAudio.position.copy(pos)  — position initiale figée
5. posSource.start(...)           — playback démarré avec cette position
```

**Problème** : les `useEffect` React s'exécutent de manière **asynchrone** après le commit (phase "passive effects"). Si un futur système d'animation repositionne le mesh dans son propre `useFrame` qui s'exécute **avant** cet effet, la lecture en étape 3 captera l'ancienne position.

Le `useFrame` de Sound corrige dès la frame suivante, mais il y aura un **bref saut spatial** (pop audio) d'une frame.

### Animation interpolée (mouvement progressif)

Le `useFrame` copie la position à chaque frame → suivi lisse, sans désync perceptible. La seule latence est la latence audio intrinsèque (~2.9 ms pour un buffer de 128 samples), indépendante du système d'animation.

---

## 4. Risques de désync

### A — Désync structurel (1 frame, acceptable)

```
Frame N   : mesh déplacé vers B par animation
            useFrame lit B → copie dans threeAudio.position
            R3F : scene.updateMatrixWorld() → panner.positionX.value = B
Frame N+1 : thread audio lit panner.positionX.value = B
```

Décalage : ~16 ms à 60 fps — sous le seuil perceptible pour l'audio spatial (inaudible sous ~50 ms).

### B — Désync critique : snapshot au setup lors d'un scrub ⚠️

```
scrub → pauseTime change → React commit
         ↓
useEffect runs (async, post-commit)
  → lit meshRef.current.children[0].worldPosition
      ← STALE si le mesh n'a pas encore été replacé
         par le système d'animation
```

**Scénario concret avec animation de keyframes future :**

```
t=5s, scrub vers t=10s
  → animation system doit déplacer mesh de [0,0,0] à [8,0,-3]
  → Sound.jsx useEffect s'exécute avant le useFrame d'animation
  → nouveau PositionalAudio part de [0,0,0] pendant ~1 frame
  → useFrame corrige à [8,0,-3] dès la frame suivante
  → résultat : pop spatial audible d'une frame
```

**Mitigation recommandée** : au setup, ne pas snapshotter la position depuis le mesh ; lire directement la valeur que l'animation aurait assignée (`resolvePosition(keyframes, scrubbedTime, manualPos)`), et l'injecter via une prop `initialPosition` dans Sound.

### C — Désync latent : `children[0]` non garanti ⚠️

Sound.jsx attend `meshRef.current.children[0]` mais la vérification est `meshRef?.current?.children?.[0]` (guard correct). Cependant, si un instrument n'a pas de `children[0]` au moment du setup (e.g., Suspense pas encore résolu), le composant tombe silencieusement dans le chemin "non assigné" (stéréo) sans erreur. La position n'est alors jamais liée au mesh.

**Mitigation** : ajouter un log de warning (non-prod) ou une prop `onSpatialReady` pour signaler à l'appelant que le path positionnel est actif.

---

## 5. Résumé

| Risque | Sévérité | Actuellement | Avec animation de keyframes |
|---|---|---|---|
| Désync 1 frame (useFrame pipeline) | Faible | Acceptable | Acceptable |
| Pop au scrub (snapshot stale) | Moyen | Invisible (pas d'animation) | **Audible** |
| `children[0]` absent → fallback stéréo silencieux | Moyen | Rare | Inchangé |
| Délai audio thread (~2.9 ms) | Faible | Toujours présent | Toujours présent |

---

## 6. Setup pour les tests unitaires

Les tests nécessitent Vitest (non présent dans `package.json`) :

```bash
npm install -D vitest
```

Ajouter dans `package.json > scripts` :
```json
"test": "vitest run",
"test:watch": "vitest"
```

Un `vitest.config.js` est fourni à la racine. Les tests se trouvent dans `src/animation/__tests__/`.
