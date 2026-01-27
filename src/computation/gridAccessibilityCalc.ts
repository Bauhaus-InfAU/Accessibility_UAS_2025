import type { HexCell, GridAttractor, DistanceMatrix } from '../config/types'
import { getUniqueNodesFromHexCells } from '../data/hexagonGrid'
import { getDistance } from './distanceMatrix'

/**
 * Calculate accessibility scores for hexagon grid cells based on attractors.
 *
 * Formula: Acc_hex = Σ(attractors j) [Att_j × f(d_ij)]
 * Where:
 * - Att_j = 1 for each attractor (fixed, like count mode)
 * - f(d_ij) = user-defined distance decay function
 * - d_ij = network distance from hexagon's node to attractor's node
 *
 * Optimization: Calculate accessibility per unique node, then copy to all hexagons at that node.
 */
export function calculateGridAccessibility(
  hexCells: HexCell[],
  attractors: GridAttractor[],
  fullMatrix: DistanceMatrix,
  curveEvaluator: (distance: number) => number
): Map<string, number> {
  const rawScores = new Map<string, number>()

  if (attractors.length === 0) {
    return rawScores
  }

  // Group hexagons by nearestNodeId for efficient calculation
  const nodeToHexCells = getUniqueNodesFromHexCells(hexCells)

  // For each unique node, calculate accessibility
  for (const [nodeId, cells] of nodeToHexCells) {
    let acc = 0

    for (const attractor of attractors) {
      // Get distance from this node to the attractor's node
      const dist = getDistance(fullMatrix, nodeId, attractor.nearestNodeId)
      if (dist === undefined) continue

      const decay = curveEvaluator(dist)
      if (decay <= 0) continue

      // Each attractor has attractivity = 1
      acc += decay
    }

    // Copy score to all hexagons at this node
    for (const cell of cells) {
      rawScores.set(cell.id, acc)
    }
  }

  return rawScores
}

/**
 * Normalize grid accessibility scores to 0-1 range
 */
export function normalizeGridScores(scores: Map<string, number>): Map<string, number> {
  if (scores.size === 0) return new Map()

  let min = Infinity
  let max = -Infinity
  for (const value of scores.values()) {
    if (value < min) min = value
    if (value > max) max = value
  }

  const range = max - min
  const normalized = new Map<string, number>()

  if (range === 0) {
    // All values are the same
    for (const [id] of scores) {
      normalized.set(id, scores.get(id)! > 0 ? 1 : 0)
    }
  } else {
    for (const [id, value] of scores) {
      normalized.set(id, (value - min) / range)
    }
  }

  return normalized
}

/**
 * Get min and max raw scores from the score map
 */
export function getGridScoreRange(scores: Map<string, number>): { min: number; max: number } {
  if (scores.size === 0) {
    return { min: 0, max: 0 }
  }

  let min = Infinity
  let max = -Infinity
  for (const value of scores.values()) {
    if (value < min) min = value
    if (value > max) max = value
  }

  return { min, max }
}
