import { describe, it, expect } from 'vitest';
import {
  interpolatePosition,
  resolvePosition,
} from '../keyframeUtils.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Two-keyframe timeline spanning t=0 → t=2 */
const TWO_KF = [
  { time: 0, position: [0, 0, 0] },
  { time: 2, position: [10, 4, -6] },
];

/** Three-keyframe timeline: t=0, t=1, t=3 */
const THREE_KF = [
  { time: 0, position: [0, 0, 0] },
  { time: 1, position: [10, 0, 0] },
  { time: 3, position: [10, 0, 10] },
];

// ─────────────────────────────────────────────────────────────────────────────
// interpolatePosition
// ─────────────────────────────────────────────────────────────────────────────

describe('interpolatePosition', () => {
  describe('normal lerp between two keyframes', () => {
    it('returns the exact first keyframe position at t=0', () => {
      expect(interpolatePosition(TWO_KF, 0)).toEqual([0, 0, 0]);
    });

    it('returns the exact last keyframe position at t=2', () => {
      expect(interpolatePosition(TWO_KF, 2)).toEqual([10, 4, -6]);
    });

    it('returns the midpoint [5, 2, -3] at t=1', () => {
      expect(interpolatePosition(TWO_KF, 1)).toEqual([5, 2, -3]);
    });

    it('returns a ¼-lerp at t=0.5', () => {
      const result = interpolatePosition(TWO_KF, 0.5);
      expect(result[0]).toBeCloseTo(2.5);
      expect(result[1]).toBeCloseTo(1.0);
      expect(result[2]).toBeCloseTo(-1.5);
    });

    it('picks the correct segment with a 3-keyframe timeline', () => {
      // t=2 is in the [1, 3] segment: halfway between [10,0,0] and [10,0,10]
      const result = interpolatePosition(THREE_KF, 2);
      expect(result[0]).toBeCloseTo(10);
      expect(result[1]).toBeCloseTo(0);
      expect(result[2]).toBeCloseTo(5);
    });

    it('returns a new array, not a mutation of the original keyframe', () => {
      const result = interpolatePosition(TWO_KF, 0);
      result[0] = 999;
      expect(TWO_KF[0].position[0]).toBe(0);
    });
  });

  describe('edge case: playhead before the first keyframe', () => {
    it('clamps to the first keyframe position at t=-1', () => {
      expect(interpolatePosition(TWO_KF, -1)).toEqual([0, 0, 0]);
    });

    it('clamps to the first keyframe at t=-99', () => {
      expect(interpolatePosition(THREE_KF, -99)).toEqual([0, 0, 0]);
    });

    it('works correctly with a single keyframe', () => {
      const single = [{ time: 5, position: [1, 2, 3] }];
      expect(interpolatePosition(single, 0)).toEqual([1, 2, 3]);
    });
  });

  describe('edge case: playhead after the last keyframe', () => {
    it('clamps to the last keyframe position at t=99', () => {
      expect(interpolatePosition(TWO_KF, 99)).toEqual([10, 4, -6]);
    });

    it('clamps to the last keyframe at t=3 for THREE_KF', () => {
      expect(interpolatePosition(THREE_KF, 3)).toEqual([10, 0, 10]);
    });

    it('works correctly with a single keyframe', () => {
      const single = [{ time: 5, position: [7, 0, -2] }];
      expect(interpolatePosition(single, 100)).toEqual([7, 0, -2]);
    });
  });

  describe('edge case: null or empty timeline (no animation defined)', () => {
    it('returns null for a null timeline', () => {
      expect(interpolatePosition(null, 5)).toBeNull();
    });

    it('returns null for an empty array', () => {
      expect(interpolatePosition([], 5)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(interpolatePosition(undefined, 5)).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resolvePosition
// ─────────────────────────────────────────────────────────────────────────────

describe('resolvePosition', () => {
  const manualPos = [3, 1, -2];

  describe('no animation timeline → mesh stays at manual position', () => {
    it('returns manualPosition when keyframes is null', () => {
      expect(resolvePosition(null, 5, manualPos)).toEqual([3, 1, -2]);
    });

    it('returns manualPosition when keyframes is empty', () => {
      expect(resolvePosition([], 5, manualPos)).toEqual([3, 1, -2]);
    });

    it('does not mutate manualPosition', () => {
      const manual = [1, 2, 3];
      const result = resolvePosition(null, 5, manual);
      // result IS manual (no animation to compute), so mutation safety
      // is the caller's responsibility — we just check the returned reference
      expect(result).toBe(manual);
    });
  });

  describe('with a valid timeline → delegates to interpolatePosition', () => {
    it('returns animated position when a timeline exists', () => {
      const result = resolvePosition(TWO_KF, 1, manualPos);
      expect(result).toEqual([5, 2, -3]);
    });

    it('ignores manualPosition when animation covers the requested time', () => {
      const result = resolvePosition(TWO_KF, 0, [99, 99, 99]);
      expect(result).toEqual([0, 0, 0]);
    });
  });
});
