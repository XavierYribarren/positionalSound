/**
 * Utility functions for keyframe-based position animation.
 *
 * A keyframe is { time: number, position: [x, y, z] }.
 * Keyframe arrays must be sorted by ascending time.
 */

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Returns the interpolated [x, y, z] position at `time` given a sorted
 * keyframe array. Clamps to the first/last keyframe outside the range.
 *
 * Returns null when keyframes is null or empty (no animation defined).
 *
 * @param {Array<{time: number, position: [number,number,number]}>|null} keyframes
 * @param {number} time - playhead time in seconds
 * @returns {[number,number,number]|null}
 */
export function interpolatePosition(keyframes, time) {
  if (!keyframes || keyframes.length === 0) return null;

  if (time <= keyframes[0].time) return [...keyframes[0].position];
  if (time >= keyframes[keyframes.length - 1].time) {
    return [...keyframes[keyframes.length - 1].position];
  }

  let lo = 0;
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (keyframes[i].time <= time && time < keyframes[i + 1].time) {
      lo = i;
      break;
    }
  }

  const a = keyframes[lo];
  const b = keyframes[lo + 1];
  const t = (time - a.time) / (b.time - a.time);

  return [
    lerp(a.position[0], b.position[0], t),
    lerp(a.position[1], b.position[1], t),
    lerp(a.position[2], b.position[2], t),
  ];
}

/**
 * Returns `manualPosition` when there is no animation timeline,
 * otherwise delegates to `interpolatePosition`.
 *
 * This is the function that Sound.jsx / the animation driver should call
 * so that the absence of a timeline is a transparent no-op.
 *
 * @param {Array|null} keyframes
 * @param {number} time
 * @param {[number,number,number]} manualPosition - current mesh position set by the user
 * @returns {[number,number,number]}
 */
export function resolvePosition(keyframes, time, manualPosition) {
  const animated = interpolatePosition(keyframes, time);
  return animated ?? manualPosition;
}

/**
 * Writes [x, y, z] into a PannerNode's position AudioParams.
 * Supports both the modern AudioParam API (positionX/Y/Z) and the
 * legacy setPosition() method.
 *
 * @param {PannerNode} panner
 * @param {number} x
 * @param {number} y
 * @param {number} z
 */
export function applyPositionToPanner(panner, x, y, z) {
  if (panner.positionX !== undefined) {
    panner.positionX.value = x;
    panner.positionY.value = y;
    panner.positionZ.value = z;
  } else {
    panner.setPosition(x, y, z);
  }
}
