import type { HexCell, StreetGraph, StreetsGeoJSON } from '../config/types'
import { DEGREES_TO_METERS } from '../config/constants'
import { findNearestNode } from './streetGraph'

// Hexagon geometry constants
const HEX_RADIUS_METERS = 10 // ~20m diameter
const HEX_RADIUS_DEGREES = HEX_RADIUS_METERS / DEGREES_TO_METERS

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
 * Check if a point is inside a polygon using ray casting algorithm
 */
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }

  return inside
}

/**
 * Check if a line segment intersects with a polygon edge
 */
function lineIntersectsSegment(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  p4: [number, number]
): boolean {
  const d1 = direction(p3, p4, p1)
  const d2 = direction(p3, p4, p2)
  const d3 = direction(p1, p2, p3)
  const d4 = direction(p1, p2, p4)

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }

  if (d1 === 0 && onSegment(p3, p4, p1)) return true
  if (d2 === 0 && onSegment(p3, p4, p2)) return true
  if (d3 === 0 && onSegment(p1, p2, p3)) return true
  if (d4 === 0 && onSegment(p1, p2, p4)) return true

  return false
}

function direction(p1: [number, number], p2: [number, number], p3: [number, number]): number {
  return (p3[0] - p1[0]) * (p2[1] - p1[1]) - (p2[0] - p1[0]) * (p3[1] - p1[1])
}

function onSegment(p1: [number, number], p2: [number, number], p: [number, number]): boolean {
  return Math.min(p1[0], p2[0]) <= p[0] && p[0] <= Math.max(p1[0], p2[0]) &&
         Math.min(p1[1], p2[1]) <= p[1] && p[1] <= Math.max(p1[1], p2[1])
}

/**
 * Check if a line segment intersects with a hexagon polygon
 */
function lineIntersectsPolygon(
  lineStart: [number, number],
  lineEnd: [number, number],
  polygon: [number, number][]
): boolean {
  // Check if either endpoint is inside the polygon
  if (pointInPolygon(lineStart, polygon) || pointInPolygon(lineEnd, polygon)) {
    return true
  }

  // Check if line intersects any polygon edge
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length
    if (lineIntersectsSegment(lineStart, lineEnd, polygon[i], polygon[j])) {
      return true
    }
  }

  return false
}

/**
 * Extract street segments from GeoJSON
 */
function extractStreetSegments(streetsGeoJSON: StreetsGeoJSON): Array<[[number, number], [number, number]]> {
  const segments: Array<[[number, number], [number, number]]> = []

  for (const feature of streetsGeoJSON.features) {
    const coords = feature.geometry.coordinates
    for (let i = 0; i < coords.length - 1; i++) {
      segments.push([
        [coords[i][0], coords[i][1]],
        [coords[i + 1][0], coords[i + 1][1]]
      ])
    }
  }

  return segments
}

/**
 * Check if a hexagon intersects any street segment using spatial indexing optimization
 */
function hexagonIntersectsStreets(
  vertices: [number, number][],
  streetSegments: Array<[[number, number], [number, number]]>,
  hexBounds: { minLng: number; maxLng: number; minLat: number; maxLat: number }
): boolean {
  // Quick bounding box check for each street segment
  for (const [start, end] of streetSegments) {
    // Check if street segment bounding box overlaps with hexagon bounding box
    const segMinLng = Math.min(start[0], end[0])
    const segMaxLng = Math.max(start[0], end[0])
    const segMinLat = Math.min(start[1], end[1])
    const segMaxLat = Math.max(start[1], end[1])

    if (segMaxLng < hexBounds.minLng || segMinLng > hexBounds.maxLng ||
        segMaxLat < hexBounds.minLat || segMinLat > hexBounds.maxLat) {
      continue // No overlap, skip
    }

    // Detailed intersection check
    if (lineIntersectsPolygon(start, end, vertices)) {
      return true
    }
  }

  return false
}

/**
 * Generate hexagonal grid covering the street network area
 */
export function generateHexagonGrid(
  graph: StreetGraph,
  streetsGeoJSON: StreetsGeoJSON,
  onProgress?: (percent: number) => void
): HexCell[] {
  const bounds = getStreetBounds(graph)
  const streetSegments = extractStreetSegments(streetsGeoJSON)

  // Padding around the bounds
  const padding = HEX_RADIUS_DEGREES * 2
  const minLng = bounds.minLng - padding
  const maxLng = bounds.maxLng + padding
  const minLat = bounds.minLat - padding
  const maxLat = bounds.maxLat + padding

  // Flat-topped hexagon dimensions
  const hexWidth = HEX_RADIUS_DEGREES * 2 // Width of hexagon
  const hexHeight = HEX_RADIUS_DEGREES * Math.sqrt(3) // Height of hexagon
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

      const vertices = hexVertices(cx, cy, HEX_RADIUS_DEGREES)

      // Calculate hexagon bounding box for optimization
      const hexBounds = {
        minLng: cx - HEX_RADIUS_DEGREES,
        maxLng: cx + HEX_RADIUS_DEGREES,
        minLat: cy - HEX_RADIUS_DEGREES * Math.sqrt(3) / 2,
        maxLat: cy + HEX_RADIUS_DEGREES * Math.sqrt(3) / 2
      }

      // Check street intersection
      const intersectsStreet = hexagonIntersectsStreets(vertices, streetSegments, hexBounds)

      // Find nearest network node for this hexagon center
      const nearestNodeId = findNearestNode(graph, [cx, cy])

      cells.push({
        id: `hex-${id++}`,
        center: [cx, cy],
        vertices,
        nearestNodeId,
        intersectsStreet
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
 * Filter hexagons that don't intersect streets (these will be rendered)
 */
export function getVisibleHexCells(cells: HexCell[]): HexCell[] {
  return cells.filter(cell => !cell.intersectsStreet)
}

/**
 * Get unique network nodes from hexagon cells for efficient calculation
 */
export function getUniqueNodesFromHexCells(cells: HexCell[]): Map<string, HexCell[]> {
  const nodeToHexCells = new Map<string, HexCell[]>()

  for (const cell of cells) {
    if (cell.intersectsStreet) continue // Skip street hexagons

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
export function hexCellsToGeoJSON(cells: HexCell[], scores?: Map<string, number>): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []

  for (const cell of cells) {
    if (cell.intersectsStreet) continue // Don't render street-intersecting hexagons

    const score = scores?.get(cell.id) ?? -1

    // Close the polygon by adding the first vertex at the end
    const ring = [...cell.vertices, cell.vertices[0]]

    features.push({
      type: 'Feature',
      properties: {
        id: cell.id,
        score,
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
