import type { MeasurementPoint, DistanceMatrix, StreetGraph } from '../config/types'
import { DEGREES_TO_METERS } from '../config/constants'
import { dijkstraWithPath, type SimpleEdge } from './dijkstraAlgorithm'

/**
 * Calculate Euclidean (straight-line) distance between two coordinates
 */
export function calculateEuclideanDistance(
  coordA: [number, number],
  coordB: [number, number]
): number {
  const dx = (coordA[0] - coordB[0]) * DEGREES_TO_METERS
  const dy = (coordA[1] - coordB[1]) * DEGREES_TO_METERS
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate network distance between two measurement points using the distance matrix
 * Returns null if the distance cannot be found in the matrix
 */
export function calculateNetworkDistance(
  pointA: MeasurementPoint,
  pointB: MeasurementPoint,
  matrix: DistanceMatrix | null
): number | null {
  if (!matrix) return null

  // Try A -> B
  const fromA = matrix.get(pointA.nearestNodeId)
  if (fromA) {
    const distAB = fromA.get(pointB.nearestNodeId)
    if (distAB !== undefined) return distAB
  }

  // Try B -> A (in case matrix is asymmetric)
  const fromB = matrix.get(pointB.nearestNodeId)
  if (fromB) {
    const distBA = fromB.get(pointA.nearestNodeId)
    if (distBA !== undefined) return distBA
  }

  return null
}

/**
 * Format distance for display: "842 m" or "1.23 km"
 */
export function formatDistance(meters: number | null): string {
  if (meters === null) return 'N/A'
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(2)} km`
}

/**
 * Find shortest path between two measurement points on the street network.
 * Returns the path as coordinates and the total distance.
 */
export function findShortestPath(
  graph: StreetGraph,
  pointA: MeasurementPoint,
  pointB: MeasurementPoint
): { distance: number; coordinates: [number, number][] } | null {
  // Convert graph adjacency to the format expected by dijkstraWithPath
  const adjacency = new Map<string, SimpleEdge[]>()
  for (const [nodeId, edges] of graph.adjacency) {
    adjacency.set(nodeId, edges.map(e => ({ to: e.to, weight: e.weight })))
  }

  const result = dijkstraWithPath(pointA.nearestNodeId, pointB.nearestNodeId, adjacency)
  if (!result) return null

  // Convert node IDs to coordinates
  const coordinates: [number, number][] = result.path.map(nodeId => {
    const node = graph.nodes.get(nodeId)
    return node ? node.coord : [0, 0]
  })

  return { distance: result.distance, coordinates }
}

/**
 * Calculate the midpoint of a path (array of coordinates).
 * Finds the point that is approximately at the middle of the total path length.
 */
export function getPathMidpoint(coordinates: [number, number][]): [number, number] {
  if (coordinates.length === 0) return [0, 0]
  if (coordinates.length === 1) return coordinates[0]
  if (coordinates.length === 2) return getLineMidpoint(coordinates[0], coordinates[1])

  // Calculate cumulative distances along the path
  const cumulativeDistances: number[] = [0]
  let totalDistance = 0

  for (let i = 1; i < coordinates.length; i++) {
    const dx = (coordinates[i][0] - coordinates[i - 1][0]) * DEGREES_TO_METERS
    const dy = (coordinates[i][1] - coordinates[i - 1][1]) * DEGREES_TO_METERS
    const segmentDist = Math.sqrt(dx * dx + dy * dy)
    totalDistance += segmentDist
    cumulativeDistances.push(totalDistance)
  }

  const halfDistance = totalDistance / 2

  // Find the segment that contains the midpoint
  for (let i = 1; i < cumulativeDistances.length; i++) {
    if (cumulativeDistances[i] >= halfDistance) {
      // Interpolate within this segment
      const segmentStart = cumulativeDistances[i - 1]
      const segmentEnd = cumulativeDistances[i]
      const segmentLength = segmentEnd - segmentStart
      const t = segmentLength > 0 ? (halfDistance - segmentStart) / segmentLength : 0

      const lng = coordinates[i - 1][0] + t * (coordinates[i][0] - coordinates[i - 1][0])
      const lat = coordinates[i - 1][1] + t * (coordinates[i][1] - coordinates[i - 1][1])
      return [lng, lat]
    }
  }

  // Fallback to last coordinate
  return coordinates[coordinates.length - 1]
}

/**
 * Calculate the midpoint of a straight line between two coordinates.
 */
export function getLineMidpoint(a: [number, number], b: [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}
