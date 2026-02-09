import type { GridAttractor, DistanceMatrix, DistanceMode } from '../config/types'
import { getDistance } from './distanceMatrix'
import { calculateEuclideanDistance } from './measurementCalc'

/**
 * Calculate accessibility score for a single vertex using network distance.
 *
 * Formula: score = Σ(attractivity_j × decayFn(dist_j))
 *
 * @param vertexNodeId - ID of the nearest network node for this vertex
 * @param attractors - Array of grid attractors (amenities)
 * @param decayFn - Distance decay function
 * @param distanceMatrix - Full network distance matrix (all nodes to all nodes)
 * @returns Raw accessibility score for the vertex
 */
export function calculateVertexScore(
  vertexNodeId: string,
  attractors: GridAttractor[],
  decayFn: (distance: number) => number,
  distanceMatrix: DistanceMatrix,
  distanceMode: DistanceMode = 'network',
  vertexCoord?: [number, number]
): number {
  let score = 0
  const isEuclidean = distanceMode === 'euclidean'

  for (const attractor of attractors) {
    const distance = isEuclidean && vertexCoord
      ? calculateEuclideanDistance(vertexCoord, attractor.coord)
      : getDistance(distanceMatrix, vertexNodeId, attractor.nearestNodeId)

    // Skip if no path exists (unreachable)
    if (distance === undefined || distance === Infinity) continue

    const decay = decayFn(distance)

    if (decay <= 0) continue

    const attractivity = attractor.attractivity ?? 1
    if (attractivity <= 0) continue

    score += attractivity * decay
  }

  return score
}

/**
 * Calculate accessibility scores for all terrain mesh vertices using network distance.
 *
 * Uses network distance lookup via pre-computed distance matrix for accurate
 * street-following accessibility patterns.
 *
 * @param vertexNodeIds - Array of nearest network node IDs for each mesh vertex
 * @param attractors - Array of grid attractors (amenities)
 * @param decayFn - Distance decay function
 * @param distanceMatrix - Full network distance matrix (all nodes to all nodes)
 * @param fixedRange - Optional fixed range for normalization. If provided, scores are
 *                     normalized to this range and clamped to [0, 1]. If not provided,
 *                     scores are normalized to their own min/max (adaptive mode).
 * @returns Object containing raw scores, normalized scores, and statistics
 */
export function calculateTerrainScores(
  vertexNodeIds: string[],
  attractors: GridAttractor[],
  decayFn: (distance: number) => number,
  distanceMatrix: DistanceMatrix,
  fixedRange?: { min: number; max: number },
  distanceMode: DistanceMode = 'network',
  vertexCoords?: [number, number][]
): { rawScores: number[]; normalizedScores: number[]; min: number; max: number; avg: number } {
  const rawScores: number[] = new Array(vertexNodeIds.length)

  // If no attractors, return zeros
  if (attractors.length === 0) {
    return {
      rawScores: new Array(vertexNodeIds.length).fill(0),
      normalizedScores: new Array(vertexNodeIds.length).fill(0),
      min: 0,
      max: 0,
      avg: 0
    }
  }

  // Calculate raw scores for all vertices
  let dataMin = Infinity
  let dataMax = -Infinity
  let sum = 0

  for (let i = 0; i < vertexNodeIds.length; i++) {
    const coord = vertexCoords ? vertexCoords[i] : undefined
    const score = calculateVertexScore(vertexNodeIds[i], attractors, decayFn, distanceMatrix, distanceMode, coord)
    rawScores[i] = score

    if (score < dataMin) dataMin = score
    if (score > dataMax) dataMax = score
    sum += score
  }

  const avg = sum / vertexNodeIds.length

  // Use fixed range if provided, otherwise use data range (adaptive mode)
  const min = fixedRange ? fixedRange.min : dataMin
  const max = fixedRange ? fixedRange.max : dataMax
  const range = max - min

  // Normalize scores to 0-1 range
  const normalizedScores: number[] = new Array(vertexNodeIds.length)

  if (range === 0) {
    // All values are the same (or fixed range has min === max)
    for (let i = 0; i < vertexNodeIds.length; i++) {
      normalizedScores[i] = rawScores[i] > 0 ? 1 : 0
    }
  } else {
    for (let i = 0; i < vertexNodeIds.length; i++) {
      // Normalize and clamp to [0, 1] (important for fixed mode where values may be outside range)
      const normalizedValue = (rawScores[i] - min) / range
      normalizedScores[i] = Math.max(0, Math.min(1, normalizedValue))
    }
  }

  // Return data min/max/avg (not fixed range values) for display in Legend
  return { rawScores, normalizedScores, min: dataMin, max: dataMax, avg }
}
