import { describe, it, expect, vi } from 'vitest';
import { applyPositionToPanner, interpolatePosition } from '../keyframeUtils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Mock factories
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal mock of a modern PannerNode (Web Audio API). */
function makePanner() {
  return {
    positionX: { value: 0 },
    positionY: { value: 0 },
    positionZ: { value: 0 },
  };
}

/** Minimal mock of a legacy PannerNode (Safari / older browsers). */
function makeLegacyPanner() {
  return {
    setPosition: vi.fn(),
  };
}

/**
 * Minimal mock of a THREE.Object3D child with a fixed world position.
 * Mirrors the real signature: `getWorldPosition(target)` mutates target and returns it.
 */
function makeMeshChild(x, y, z) {
  return {
    getWorldPosition(vec) {
      vec.x = x;
      vec.y = y;
      vec.z = z;
      return vec;
    },
  };
}

/**
 * Mirrors the core of Sound.jsx's useFrame (lines 347–351) as a pure function
 * so it can be tested without R3F.
 *
 * In Sound.jsx the equivalent is:
 *   const pos = new THREE.Vector3();
 *   meshRef.current.children[0].getWorldPosition(pos);
 *   threeAudioRef.current.position.copy(pos);
 *
 * Here we skip the intermediate THREE.PositionalAudio and write directly to
 * the PannerNode, which is what `PositionalAudio.updateMatrixWorld()` does.
 */
function syncMeshWorldPosToPanner(meshChild, panner) {
  const pos = { x: 0, y: 0, z: 0 };
  meshChild.getWorldPosition(pos);
  applyPositionToPanner(panner, pos.x, pos.y, pos.z);
}

// ─────────────────────────────────────────────────────────────────────────────
// applyPositionToPanner
// ─────────────────────────────────────────────────────────────────────────────

describe('applyPositionToPanner', () => {
  describe('modern AudioParam API (positionX/Y/Z)', () => {
    it('sets positionX, positionY, positionZ to the supplied values', () => {
      const panner = makePanner();
      applyPositionToPanner(panner, 3, 1, -5);
      expect(panner.positionX.value).toBe(3);
      expect(panner.positionY.value).toBe(1);
      expect(panner.positionZ.value).toBe(-5);
    });

    it('accepts negative coordinates', () => {
      const panner = makePanner();
      applyPositionToPanner(panner, -10, -0.5, -100);
      expect(panner.positionX.value).toBe(-10);
      expect(panner.positionY.value).toBe(-0.5);
      expect(panner.positionZ.value).toBe(-100);
    });

    it('accepts zero', () => {
      const panner = makePanner();
      applyPositionToPanner(panner, 0, 0, 0);
      expect(panner.positionX.value).toBe(0);
      expect(panner.positionY.value).toBe(0);
      expect(panner.positionZ.value).toBe(0);
    });

    it('overwrites a previously set position', () => {
      const panner = makePanner();
      applyPositionToPanner(panner, 5, 5, 5);
      applyPositionToPanner(panner, 1, 2, 3);
      expect(panner.positionX.value).toBe(1);
      expect(panner.positionY.value).toBe(2);
      expect(panner.positionZ.value).toBe(3);
    });
  });

  describe('legacy setPosition() API', () => {
    it('falls back to setPosition() when positionX is undefined', () => {
      const panner = makeLegacyPanner();
      applyPositionToPanner(panner, 2, 0, 4);
      expect(panner.setPosition).toHaveBeenCalledTimes(1);
      expect(panner.setPosition).toHaveBeenCalledWith(2, 0, 4);
    });

    it('passes all three coordinates to setPosition()', () => {
      const panner = makeLegacyPanner();
      applyPositionToPanner(panner, -3, 7, 0);
      expect(panner.setPosition).toHaveBeenCalledWith(-3, 7, 0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mesh world position → PannerNode sync  (mirrors Sound.jsx useFrame)
// ─────────────────────────────────────────────────────────────────────────────

describe('syncMeshWorldPosToPanner', () => {
  it('reflects the mesh world position into the panner on first sync', () => {
    const panner = makePanner();
    const mesh = makeMeshChild(7, 2, -3);
    syncMeshWorldPosToPanner(mesh, panner);
    expect(panner.positionX.value).toBe(7);
    expect(panner.positionY.value).toBe(2);
    expect(panner.positionZ.value).toBe(-3);
  });

  it('updates the panner when the mesh moves to a new position', () => {
    const panner = makePanner();
    let pos = [0, 0, 0];
    const mesh = { getWorldPosition(v) { [v.x, v.y, v.z] = pos; return v; } };

    syncMeshWorldPosToPanner(mesh, panner);
    expect(panner.positionX.value).toBe(0);

    pos = [5, 0, 5];
    syncMeshWorldPosToPanner(mesh, panner);
    expect(panner.positionX.value).toBe(5);
    expect(panner.positionZ.value).toBe(5);
  });

  it('converges to the correct position after a sudden jump (scrub scenario)', () => {
    const panner = makePanner();
    let pos = [0, 0, 0];
    const mesh = { getWorldPosition(v) { [v.x, v.y, v.z] = pos; return v; } };

    // Frame 1 — initial position
    syncMeshWorldPosToPanner(mesh, panner);
    expect(panner.positionX.value).toBe(0);

    // Timeline scrub: mesh teleports
    pos = [50, 0, -20];

    // Frame 2 — useFrame corrects immediately
    syncMeshWorldPosToPanner(mesh, panner);
    expect(panner.positionX.value).toBe(50);
    expect(panner.positionZ.value).toBe(-20);
  });

  it('does not modify the panner when mesh is at the same position (idempotent)', () => {
    const panner = makePanner();
    const mesh = makeMeshChild(3, 1, -2);

    syncMeshWorldPosToPanner(mesh, panner);
    const x1 = panner.positionX.value;

    syncMeshWorldPosToPanner(mesh, panner);
    expect(panner.positionX.value).toBe(x1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: keyframe animation → panner sync pipeline
// ─────────────────────────────────────────────────────────────────────────────

describe('keyframe animation → panner sync pipeline', () => {
  const keyframes = [
    { time: 0, position: [0, 0, 0] },
    { time: 4, position: [40, 0, -20] },
  ];

  it('routes an animated position into the panner at t=2 (midpoint)', () => {
    const panner = makePanner();
    const pos = interpolatePosition(keyframes, 2);
    applyPositionToPanner(panner, ...pos);

    expect(panner.positionX.value).toBeCloseTo(20);
    expect(panner.positionY.value).toBeCloseTo(0);
    expect(panner.positionZ.value).toBeCloseTo(-10);
  });

  it('panner position at t=0 matches first keyframe', () => {
    const panner = makePanner();
    const pos = interpolatePosition(keyframes, 0);
    applyPositionToPanner(panner, ...pos);
    expect(panner.positionX.value).toBe(0);
    expect(panner.positionZ.value).toBe(0);
  });

  it('panner position at t=4 matches last keyframe', () => {
    const panner = makePanner();
    const pos = interpolatePosition(keyframes, 4);
    applyPositionToPanner(panner, ...pos);
    expect(panner.positionX.value).toBe(40);
    expect(panner.positionZ.value).toBe(-20);
  });

  it('panner position before t=0 is clamped to first keyframe', () => {
    const panner = makePanner();
    const pos = interpolatePosition(keyframes, -10);
    applyPositionToPanner(panner, ...pos);
    expect(panner.positionX.value).toBe(0);
    expect(panner.positionZ.value).toBe(0);
  });

  it('panner position after t=4 is clamped to last keyframe', () => {
    const panner = makePanner();
    const pos = interpolatePosition(keyframes, 99);
    applyPositionToPanner(panner, ...pos);
    expect(panner.positionX.value).toBe(40);
    expect(panner.positionZ.value).toBe(-20);
  });
});
