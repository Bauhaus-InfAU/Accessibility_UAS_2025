import type { Building, GraphNode, GraphEdge, StreetGraph, StreetsGeoJSON, SerializedGraph } from '../config/types'
import { COORD_PRECISION, DEGREES_TO_METERS } from '../config/constants'

function coordKey(coord: [number, number]): string {
  return `${coord[0].toFixed(COORD_PRECISION)},${coord[1].toFixed(COORD_PRECISION)}`
}

function distanceMeters(a: [number, number], b: [number, number]): number {
  const dx = (a[0] - b[0]) * DEGREES_TO_METERS
  const dy = (a[1] - b[1]) * DEGREES_TO_METERS
  return Math.sqrt(dx * dx + dy * dy)
}

export function buildStreetGraph(geojson: StreetsGeoJSON): StreetGraph {
  const nodes = new Map<string, GraphNode>()
  const adjacency = new Map<string, GraphEdge[]>()

  for (const feature of geojson.features) {
    const coords = feature.geometry.coordinates
    if (coords.length < 2) continue

    // Each street segment has start and end nodes
    const startCoord: [number, number] = [coords[0][0], coords[0][1]]
    const endCoord: [number, number] = [coords[coords.length - 1][0], coords[coords.length - 1][1]]

    const startKey = coordKey(startCoord)
    const endKey = coordKey(endCoord)

    if (!nodes.has(startKey)) {
      nodes.set(startKey, { id: startKey, coord: startCoord })
    }
    if (!nodes.has(endKey)) {
      nodes.set(endKey, { id: endKey, coord: endCoord })
    }

    // Use the length property if available, otherwise calculate
    const length = feature.properties?.length
      ? parseFloat(feature.properties.length)
      : distanceMeters(startCoord, endCoord)

    // Bidirectional edges
    if (!adjacency.has(startKey)) adjacency.set(startKey, [])
    if (!adjacency.has(endKey)) adjacency.set(endKey, [])

    adjacency.get(startKey)!.push({ to: endKey, weight: length })
    adjacency.get(endKey)!.push({ to: startKey, weight: length })
  }

  return { nodes, adjacency }
}

export function findNearestNode(graph: StreetGraph, coord: [number, number]): string {
  let nearestId = ''
  let nearestDist = Infinity

  for (const [id, node] of graph.nodes) {
    const dist = distanceMeters(coord, node.coord)
    if (dist < nearestDist) {
      nearestDist = dist
      nearestId = id
    }
  }

  return nearestId
}

export function mapBuildingsToNodes(buildings: Building[], graph: StreetGraph): void {
  for (const building of buildings) {
    building.nearestNodeId = findNearestNode(graph, building.centroid)
  }
}

export function serializeGraph(graph: StreetGraph): SerializedGraph {
  const nodes: SerializedGraph['nodes'] = []
  const edges: SerializedGraph['edges'] = []

  for (const [id, node] of graph.nodes) {
    nodes.push({ id, coord: node.coord })
  }

  for (const [from, edgeList] of graph.adjacency) {
    for (const edge of edgeList) {
      edges.push({ from, to: edge.to, weight: edge.weight })
    }
  }

  return { nodes, edges }
}
