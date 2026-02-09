import type { ExplorerResult, StreetGraph, DistanceMatrix } from '../config/types'
import { EXPLORER_PALETTE, EXPLORER_MAX_DISPLAY } from '../config/constants'
import { getDistance } from './distanceMatrix'
import { findShortestPath } from './measurementCalc'

interface AmenityInput {
  id: string
  label: string
  coord: [number, number]
  nodeId: string
  attractivity: number
}

/**
 * Compute explorer results for a flag location, showing the contribution
 * of each amenity to the accessibility score at that point.
 *
 * 1. Looks up network distances from the distance matrix (O(1) per amenity)
 * 2. Computes decay and partial scores (preserving original amenity order)
 * 3. For the top N amenities, finds the shortest path (for visualization)
 * 4. Assigns palette colors
 */
export function computeExplorerResults(
  flagNodeId: string,
  amenities: AmenityInput[],
  graph: StreetGraph,
  distanceMatrix: DistanceMatrix,
  decayFn: (d: number) => number,
  maxDisplay: number = EXPLORER_MAX_DISPLAY
): ExplorerResult[] {
  // Step 1+2: compute distances and partial scores
  const scored: Array<{
    amenity: AmenityInput
    networkDistance: number
    decayValue: number
    partialScore: number
  }> = []

  for (const amenity of amenities) {
    const dist = getDistance(distanceMatrix, flagNodeId, amenity.nodeId)
    if (dist === undefined) continue

    const decayValue = decayFn(dist)
    const partialScore = amenity.attractivity * decayValue

    scored.push({
      amenity,
      networkDistance: dist,
      decayValue,
      partialScore,
    })
  }

  // Take top N (preserving original amenity order for stable color assignment)
  const topN = scored.slice(0, maxDisplay)

  // Step 3+4: compute paths and assign colors
  const results: ExplorerResult[] = []

  for (let i = 0; i < topN.length; i++) {
    const { amenity, networkDistance, decayValue, partialScore } = topN[i]

    // Find shortest path for visualization
    const pathResult = findShortestPath(
      graph,
      { id: 'A', coord: [0, 0], nearestNodeId: flagNodeId }, // coord unused by findShortestPath
      { id: 'B', coord: amenity.coord, nearestNodeId: amenity.nodeId }
    )

    const networkPath = pathResult?.coordinates ?? []

    results.push({
      amenityId: amenity.id,
      amenityLabel: amenity.label,
      amenityCoord: amenity.coord,
      attractivity: amenity.attractivity,
      networkDistance,
      decayValue,
      partialScore,
      networkPath,
      color: EXPLORER_PALETTE[i % EXPLORER_PALETTE.length],
    })
  }

  return results
}
