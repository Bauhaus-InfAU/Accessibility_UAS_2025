import type { ControlPoint, CurveMode } from '../config/types'

/**
 * Evaluate a polyline curve at a given distance.
 * Points must be sorted by x. Linearly interpolates between points.
 */
function evaluatePolyline(points: ControlPoint[], distance: number): number {
  if (points.length === 0) return 0
  if (distance <= points[0].x) return points[0].y
  if (distance >= points[points.length - 1].x) return points[points.length - 1].y

  // Find the two points bracketing the distance
  for (let i = 0; i < points.length - 1; i++) {
    if (distance >= points[i].x && distance <= points[i + 1].x) {
      const t = (distance - points[i].x) / (points[i + 1].x - points[i].x)
      return points[i].y + t * (points[i + 1].y - points[i].y)
    }
  }

  return 0
}

/**
 * Evaluate a cubic bezier curve at a given distance.
 * The bezier goes from (0, 1) to (maxDistance, 0) with two control handles.
 *
 * handles: [[cx1, cy1], [cx2, cy2]] - the two control point coordinates
 */
function evaluateBezier(
  handles: [[number, number], [number, number]],
  maxDistance: number,
  distance: number
): number {
  if (distance <= 0) return 1
  if (distance >= maxDistance) return 0

  // Start point: (0, 1), End point: (maxDistance, 0)
  const p0x = 0, p0y = 1
  const p1x = handles[0][0], p1y = handles[0][1]
  const p2x = handles[1][0], p2y = handles[1][1]
  const p3x = maxDistance, p3y = 0

  // We need to find t such that bezierX(t) = distance
  // Then return bezierY(t)
  // Use binary search on t since x is monotonically increasing (should be)
  let lo = 0, hi = 1
  for (let iter = 0; iter < 30; iter++) {
    const mid = (lo + hi) / 2
    const x = cubicBezier(mid, p0x, p1x, p2x, p3x)
    if (x < distance) {
      lo = mid
    } else {
      hi = mid
    }
  }

  const t = (lo + hi) / 2
  const y = cubicBezier(t, p0y, p1y, p2y, p3y)
  return Math.max(0, Math.min(1, y))
}

function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const mt = 1 - t
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3
}

/**
 * Create a curve evaluator function from the current curve state.
 */
export function createCurveEvaluator(
  mode: CurveMode,
  polylinePoints: ControlPoint[],
  bezierHandles: [[number, number], [number, number]],
  maxDistance: number
): (distance: number) => number {
  if (mode === 'polyline') {
    const sorted = [...polylinePoints].sort((a, b) => a.x - b.x)
    return (distance: number) => evaluatePolyline(sorted, distance)
  } else {
    return (distance: number) => evaluateBezier(bezierHandles, maxDistance, distance)
  }
}
