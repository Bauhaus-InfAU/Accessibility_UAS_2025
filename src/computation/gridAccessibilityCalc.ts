import type { HexCell, GridAttractor, DistanceMatrix, DistanceMode } from '../config/types'
import { getUniqueNodesFromHexCells } from '../data/hexagonGrid'
import { getDistance } from './distanceMatrix'
import { calculateEuclideanDistance } from './measurementCalc'

/**
 * Calculate accessibility scores for hexagon grid cells based on amenities.
 *
 * Formula: Acc_hex = Σ(amenities j) [Att_j × f(d_ij)]
 * Where:
 * - Att_j = user-defined attractivity for each amenity
 * - f(d_ij) = user-defined distance decay function
 * - d_ij = network distance from hexagon's node to amenity's node
 *
 * Optimization: Calculate accessibility per unique node, then copy to all hexagons at that node.
 */
export function calculateGridAccessibility(
  hexCells: HexCell[],
  amenities: GridAttractor[],
  fullMatrix: DistanceMatrix,
  curveEvaluator: (distance: number) => number,
  distanceMode: DistanceMode = 'network'
): Map<string, number> {
  const rawScores = new Map<string, number>()

  if (amenities.length === 0) {
    return rawScores
  }

  if (distanceMode === 'euclidean') {
    // Euclidean mode: iterate cells directly, compute straight-line distance
    for (const cell of hexCells) {
      let acc = 0
      for (const amenity of amenities) {
        const dist = calculateEuclideanDistance(cell.center, amenity.coord)
        const decay = curveEvaluator(dist)
        if (decay <= 0) continue

        const attractivity = amenity.attractivity ?? 1
        if (attractivity <= 0) continue

        acc += attractivity * decay
      }
      rawScores.set(cell.id, acc)
    }
    return rawScores
  }

  // Network mode: group hexagons by nearestNodeId for efficient calculation
  const nodeToHexCells = getUniqueNodesFromHexCells(hexCells)

  // For each unique node, calculate accessibility
  for (const [nodeId, cells] of nodeToHexCells) {
    let acc = 0

    for (const amenity of amenities) {
      // Get distance from this node to the amenity's node
      const dist = getDistance(fullMatrix, nodeId, amenity.nearestNodeId)
      if (dist === undefined) continue

      const decay = curveEvaluator(dist)
      if (decay <= 0) continue

      // Use amenity's attractivity value
      const attractivity = amenity.attractivity ?? 1
      if (attractivity <= 0) continue

      acc += attractivity * decay
    }

    // Copy score to all hexagons at this node
    for (const cell of cells) {
      rawScores.set(cell.id, acc)
    }
  }

  return rawScores
}

/**
 * Normalize grid accessibility scores to 0-1 range.
 *
 * @param scores - Raw accessibility scores
 * @param fixedRange - Optional fixed range for normalization. If provided, scores are
 *                     normalized to this range and clamped to [0, 1]. If not provided,
 *                     scores are normalized to their own min/max (adaptive mode).
 */
export function normalizeGridScores(
  scores: Map<string, number>,
  fixedRange?: { min: number; max: number }
): Map<string, number> {
  if (scores.size === 0) return new Map()

  let min: number
  let max: number

  if (fixedRange) {
    // Use fixed range provided by user
    min = fixedRange.min
    max = fixedRange.max
  } else {
    // Adaptive mode: calculate min/max from data
    min = Infinity
    max = -Infinity
    for (const value of scores.values()) {
      if (value < min) min = value
      if (value > max) max = value
    }
  }

  const range = max - min
  const normalized = new Map<string, number>()

  if (range === 0) {
    // All values are the same (or fixed range has min === max)
    for (const [id] of scores) {
      normalized.set(id, scores.get(id)! > 0 ? 1 : 0)
    }
  } else {
    for (const [id, value] of scores) {
      // Normalize and clamp to [0, 1] (important for fixed mode where values may be outside range)
      const normalizedValue = (value - min) / range
      normalized.set(id, Math.max(0, Math.min(1, normalizedValue)))
    }
  }

  return normalized
}

/**
 * Get min, max, and avg raw scores from the score map
 */
export function getGridScoreStats(scores: Map<string, number>): { min: number; max: number; avg: number } {
  if (scores.size === 0) {
    return { min: 0, max: 0, avg: 0 }
  }

  let min = Infinity
  let max = -Infinity
  let sum = 0
  for (const value of scores.values()) {
    if (value < min) min = value
    if (value > max) max = value
    sum += value
  }

  return { min, max, avg: sum / scores.size }
}
