import type { GridAttractor } from '../config/types'
import { DEGREES_TO_METERS } from '../config/constants'

/**
 * Calculate Euclidean distance between two coordinates in meters
 */
function euclideanDistance(coord1: [number, number], coord2: [number, number]): number {
  const dx = (coord1[0] - coord2[0]) * DEGREES_TO_METERS
  const dy = (coord1[1] - coord2[1]) * DEGREES_TO_METERS
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate accessibility score for a single vertex using Euclidean distance.
 *
 * Formula: score = Σ(attractivity_j × decayFn(dist_j))
 *
 * @param vertexLngLat - [lng, lat] coordinates of the vertex
 * @param attractors - Array of grid attractors (amenities)
 * @param decayFn - Distance decay function
 * @returns Raw accessibility score for the vertex
 */
export function calculateVertexScore(
  vertexLngLat: [number, number],
  attractors: GridAttractor[],
  decayFn: (distance: number) => number
): number {
  let score = 0

  for (const attractor of attractors) {
    const distance = euclideanDistance(vertexLngLat, attractor.coord)
    const decay = decayFn(distance)

    if (decay <= 0) continue

    const attractivity = attractor.attractivity ?? 1
    if (attractivity <= 0) continue

    score += attractivity * decay
  }

  return score
}

/**
 * Calculate accessibility scores for all terrain mesh vertices using Euclidean distance.
 *
 * This is optimized for real-time performance (~1ms for 4225 vertices).
 * Uses Euclidean distance instead of network distance for speed.
 *
 * @param vertices - Array of [lng, lat] coordinates for each mesh vertex
 * @param attractors - Array of grid attractors (amenities)
 * @param decayFn - Distance decay function
 * @returns Object containing raw scores, normalized scores, and statistics
 */
export function calculateTerrainScores(
  vertices: [number, number][],
  attractors: GridAttractor[],
  decayFn: (distance: number) => number
): { rawScores: number[]; normalizedScores: number[]; min: number; max: number; avg: number } {
  const rawScores: number[] = new Array(vertices.length)

  // If no attractors, return zeros
  if (attractors.length === 0) {
    return {
      rawScores: new Array(vertices.length).fill(0),
      normalizedScores: new Array(vertices.length).fill(0),
      min: 0,
      max: 0,
      avg: 0
    }
  }

  // Calculate raw scores for all vertices
  let min = Infinity
  let max = -Infinity
  let sum = 0

  for (let i = 0; i < vertices.length; i++) {
    const score = calculateVertexScore(vertices[i], attractors, decayFn)
    rawScores[i] = score

    if (score < min) min = score
    if (score > max) max = score
    sum += score
  }

  const avg = sum / vertices.length
  const range = max - min

  // Normalize scores to 0-1 range
  const normalizedScores: number[] = new Array(vertices.length)

  if (range === 0) {
    // All values are the same
    for (let i = 0; i < vertices.length; i++) {
      normalizedScores[i] = rawScores[i] > 0 ? 1 : 0
    }
  } else {
    for (let i = 0; i < vertices.length; i++) {
      normalizedScores[i] = (rawScores[i] - min) / range
    }
  }

  return { rawScores, normalizedScores, min, max, avg }
}
