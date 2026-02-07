import type { HexCell, StreetGraph } from '../config/types'
import { DEGREES_TO_METERS, HEX_DIAMETER_DEFAULT } from '../config/constants'

/**
 * Find the nearest node and return both ID and distance in meters
 */
function findNearestNodeWithDistance(graph: StreetGraph, coord: [number, number]): { nodeId: string; distance: number } {
  let nearestId = ''
  let nearestDist = Infinity

  for (const [id, node] of graph.nodes) {
    const dx = (coord[0] - node.coord[0]) * DEGREES_TO_METERS
    const dy = (coord[1] - node.coord[1]) * DEGREES_TO_METERS
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < nearestDist) {
      nearestDist = dist
      nearestId = id
    }
  }

  return { nodeId: nearestId, distance: nearestDist }
}

// Maximum distance from network to include a hexagon (in meters)
// Also used for bounding box padding to create organic shape around network
const MAX_DISTANCE_FROM_NETWORK = 100

/**
 * Calculate the bounding box of the street network
 */
function getStreetBounds(graph: StreetGraph): { minLng: number; maxLng: number; minLat: number; maxLat: number } {
  let minLng = Infinity, maxLng = -Infinity
  let minLat = Infinity, maxLat = -Infinity

  for (const node of graph.nodes.values()) {
    const [lng, lat] = node.coord
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }

  return { minLng, maxLng, minLat, maxLat }
}

/**
 * Generate 6 vertices for a flat-topped hexagon centered at (cx, cy)
 */
function hexVertices(cx: number, cy: number, radius: number): [number, number][] {
  const vertices: [number, number][] = []
  for (let i = 0; i < 6; i++) {
    // Flat-topped hexagon: angles start at 0 degrees
    const angle = (Math.PI / 3) * i
    const x = cx + radius * Math.cos(angle)
    const y = cy + radius * Math.sin(angle)
    vertices.push([x, y])
  }
  return vertices
}

/**
 * Generate hexagonal grid covering the street network area
 * @param graph - The street graph for network distance calculations
 * @param hexDiameterMeters - Diameter of each hexagon in meters (default: 15m)
 * @param onProgress - Optional progress callback (0-100)
 */
export function generateHexagonGrid(
  graph: StreetGraph,
  hexDiameterMeters: number = HEX_DIAMETER_DEFAULT,
  onProgress?: (percent: number) => void
): HexCell[] {
  const bounds = getStreetBounds(graph)

  // Calculate hexagon radius from diameter
  const hexRadiusMeters = hexDiameterMeters / 2
  const hexRadiusDegrees = hexRadiusMeters / DEGREES_TO_METERS

  // Padding around the bounds (same as max distance filter for organic shape)
  const paddingMeters = MAX_DISTANCE_FROM_NETWORK
  const paddingDegrees = paddingMeters / DEGREES_TO_METERS
  const minLng = bounds.minLng - paddingDegrees
  const maxLng = bounds.maxLng + paddingDegrees
  const minLat = bounds.minLat - paddingDegrees
  const maxLat = bounds.maxLat + paddingDegrees

  // Flat-topped hexagon dimensions
  const hexWidth = hexRadiusDegrees * 2 // Width of hexagon
  const hexHeight = hexRadiusDegrees * Math.sqrt(3) // Height of hexagon
  const colOffset = hexWidth * 0.75 // Horizontal offset between columns
  const rowOffset = hexHeight // Vertical offset between rows

  const cells: HexCell[] = []
  let id = 0

  // Estimate total hexagons for progress
  const cols = Math.ceil((maxLng - minLng) / colOffset)
  const rows = Math.ceil((maxLat - minLat) / rowOffset)
  const totalEstimate = cols * rows
  let processed = 0
  let lastProgressPct = 0

  // Generate hexagons in offset grid pattern
  for (let col = 0; col <= cols; col++) {
    const cx = minLng + col * colOffset

    for (let row = 0; row <= rows; row++) {
      // Offset every other column by half the row height
      const cy = minLat + row * rowOffset + (col % 2 === 1 ? rowOffset / 2 : 0)

      const vertices = hexVertices(cx, cy, hexRadiusDegrees)

      // Find nearest network node and distance for this hexagon center
      const { nodeId: nearestNodeId, distance: distanceToNetwork } = findNearestNodeWithDistance(graph, [cx, cy])

      // Skip hexagons too far from the network
      if (distanceToNetwork > MAX_DISTANCE_FROM_NETWORK) {
        continue
      }

      cells.push({
        id: `hex-${id++}`,
        center: [cx, cy],
        vertices,
        nearestNodeId,
      })

      processed++
      if (onProgress) {
        const pct = Math.floor((processed / totalEstimate) * 100)
        if (pct > lastProgressPct) {
          lastProgressPct = pct
          onProgress(pct)
        }
      }
    }
  }

  return cells
}

/**
 * Get unique network nodes from hexagon cells for efficient calculation
 */
export function getUniqueNodesFromHexCells(cells: HexCell[]): Map<string, HexCell[]> {
  const nodeToHexCells = new Map<string, HexCell[]>()

  for (const cell of cells) {
    const existing = nodeToHexCells.get(cell.nearestNodeId)
    if (existing) {
      existing.push(cell)
    } else {
      nodeToHexCells.set(cell.nearestNodeId, [cell])
    }
  }

  return nodeToHexCells
}

/**
 * Convert hexagon cells to GeoJSON for MapLibre rendering
 */
export function hexCellsToGeoJSON(cells: HexCell[], scores?: Map<string, number>, rawScores?: Map<string, number>): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []

  for (const cell of cells) {
    const score = scores?.get(cell.id) ?? -1

    // Close the polygon by adding the first vertex at the end
    const ring = [...cell.vertices, cell.vertices[0]]

    features.push({
      type: 'Feature',
      properties: {
        id: cell.id,
        score,
        rawScore: rawScores?.get(cell.id) ?? -1,
        nearestNodeId: cell.nearestNodeId
      },
      geometry: {
        type: 'Polygon',
        coordinates: [ring]
      }
    })
  }

  return {
    type: 'FeatureCollection',
    features
  }
}
