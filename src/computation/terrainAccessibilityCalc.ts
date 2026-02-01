import type { GridAttractor, DistanceMatrix } from '../config/types'
import { getDistance } from './distanceMatrix'

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
  distanceMatrix: DistanceMatrix
): number {
  let score = 0

  for (const attractor of attractors) {
    // Look up network distance from vertex's nearest node to attractor's nearest node
    const distance = getDistance(distanceMatrix, vertexNodeId, attractor.nearestNodeId)

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
 * @returns Object containing raw scores, normalized scores, and statistics
 */
export function calculateTerrainScores(
  vertexNodeIds: string[],
  attractors: GridAttractor[],
  decayFn: (distance: number) => number,
  distanceMatrix: DistanceMatrix
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
  let min = Infinity
  let max = -Infinity
  let sum = 0

  for (let i = 0; i < vertexNodeIds.length; i++) {
    const score = calculateVertexScore(vertexNodeIds[i], attractors, decayFn, distanceMatrix)
    rawScores[i] = score

    if (score < min) min = score
    if (score > max) max = score
    sum += score
  }

  const avg = sum / vertexNodeIds.length
  const range = max - min

  // Normalize scores to 0-1 range
  const normalizedScores: number[] = new Array(vertexNodeIds.length)

  if (range === 0) {
    // All values are the same
    for (let i = 0; i < vertexNodeIds.length; i++) {
      normalizedScores[i] = rawScores[i] > 0 ? 1 : 0
    }
  } else {
    for (let i = 0; i < vertexNodeIds.length; i++) {
      normalizedScores[i] = (rawScores[i] - min) / range
    }
  }

  return { rawScores, normalizedScores, min, max, avg }
}
