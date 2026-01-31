import * as THREE from 'three'
import maplibregl from 'maplibre-gl'
import type { StreetGraph, GridAttractor } from '../config/types'
import { DEGREES_TO_METERS, TERRAIN_SEGMENTS, TERRAIN_HEIGHT_SCALE } from '../config/constants'
import { calculateTerrainScores } from '../computation/terrainAccessibilityCalc'
import { SDFLineMaterial, createSDFLineGeometry, updateSDFLineGeometry } from './SDFLineMaterial'

export { TERRAIN_SEGMENTS }

// Re-export lngLatToLocalMeters for external use
export { lngLatToLocalMeters }

// Street network constants
export const STREET_NETWORK_Z_OFFSET = 3  // meters above terrain
export const STREET_NETWORK_COLOR = 0xffffff  // white
export const STREET_NETWORK_LINE_WIDTH = 2  // pixels

/**
 * Configuration for terrain mesh creation
 */
export interface TerrainMeshConfig {
  minLng: number
  maxLng: number
  minLat: number
  maxLat: number
  segmentsX: number
  segmentsY: number
  // Mercator coordinate bounds (computed from lng/lat)
  mercatorMinX: number
  mercatorMaxX: number
  mercatorMinY: number
  mercatorMaxY: number
  // Scale factor (meters per Mercator unit at center)
  meterScale: number
}

/**
 * Get the accessibility gradient color for a normalized score (0-1)
 * Purple (#4A3AB4) -> Orange (#FD681D) -> Red (#FD1D1D)
 */
function getColorForScore(score: number): THREE.Color {
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  const t = clamp(score)

  const purple = new THREE.Color(0x4A3AB4)
  const orange = new THREE.Color(0xFD681D)
  const red = new THREE.Color(0xFD1D1D)

  if (t < 0.5) {
    // Interpolate purple -> orange
    const t2 = t * 2
    return purple.clone().lerp(orange, t2)
  } else {
    // Interpolate orange -> red
    const t2 = (t - 0.5) * 2
    return orange.clone().lerp(red, t2)
  }
}

/**
 * Calculate bounds from street graph nodes and convert to Mercator coordinates
 */
export function getGraphBounds(graph: StreetGraph): TerrainMeshConfig {
  let minLng = Infinity, maxLng = -Infinity
  let minLat = Infinity, maxLat = -Infinity

  for (const node of graph.nodes.values()) {
    const [lng, lat] = node.coord
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }

  // Add padding around the bounds (100m to match hexagon grid)
  const paddingDegrees = 100 / DEGREES_TO_METERS
  minLng -= paddingDegrees
  maxLng += paddingDegrees
  minLat -= paddingDegrees
  maxLat += paddingDegrees

  // Convert corners to Mercator coordinates
  const minCoord = maplibregl.MercatorCoordinate.fromLngLat([minLng, minLat])
  const maxCoord = maplibregl.MercatorCoordinate.fromLngLat([maxLng, maxLat])
  const centerCoord = maplibregl.MercatorCoordinate.fromLngLat(
    [(minLng + maxLng) / 2, (minLat + maxLat) / 2]
  )

  // Get scale factor (meters per Mercator unit at this latitude)
  const meterScale = centerCoord.meterInMercatorCoordinateUnits()

  // In Web Mercator, Y decreases as latitude increases (Y increases towards south)
  // So maxLat actually has a SMALLER mercatorY than minLat
  // We need to swap them to get correct min/max for the geometry
  const mercatorMinY = Math.min(minCoord.y, maxCoord.y)
  const mercatorMaxY = Math.max(minCoord.y, maxCoord.y)

  return {
    minLng,
    maxLng,
    minLat,
    maxLat,
    mercatorMinX: minCoord.x,
    mercatorMaxX: maxCoord.x,
    mercatorMinY,
    mercatorMaxY,
    meterScale,
    segmentsX: TERRAIN_SEGMENTS,
    segmentsY: TERRAIN_SEGMENTS
  }
}

/**
 * Create a terrain mesh with specified bounds and resolution
 *
 * The mesh is created in Mercator coordinates, which MapLibre uses internally.
 * MapLibre's 3D coordinate system has:
 * - X: Mercator X (east)
 * - Y: Mercator Y (south, in standard Web Mercator)
 * - Z: Altitude (up)
 *
 * PlaneGeometry creates vertices in the XY plane with normals pointing +Z.
 * We need to rotate it to be horizontal (XY plane for position, Z for height).
 * Actually, for MapLibre custom layers, the plane should be in the XY plane
 * because that's how MapLibre renders 3D content.
 */
export function createTerrainMesh(config: TerrainMeshConfig): THREE.Mesh {
  const width = config.mercatorMaxX - config.mercatorMinX
  const height = config.mercatorMaxY - config.mercatorMinY

  // Create a highly-subdivided plane in Mercator space
  // PlaneGeometry creates vertices in the XY plane
  const geometry = new THREE.PlaneGeometry(
    width,
    height,
    config.segmentsX,
    config.segmentsY
  )

  // Position vertices at correct Mercator coordinates
  const positions = geometry.attributes.position.array as Float32Array
  const vertexCount = (config.segmentsX + 1) * (config.segmentsY + 1)

  const centerX = (config.mercatorMinX + config.mercatorMaxX) / 2
  const centerY = (config.mercatorMinY + config.mercatorMaxY) / 2

  // Store lng/lat coordinates for each vertex for later interpolation
  const lngLatCoords: [number, number][] = []

  // MapLibre custom layers use:
  // 1. Model vertices in METERS, centered at origin
  // 2. Model matrix: translate(mercatorXY) * scale(meterInMercatorUnits)
  // This converts meters to Mercator and positions the model

  for (let i = 0; i < vertexCount; i++) {
    // Current position relative to center from PlaneGeometry (in Mercator units)
    const localMercX = positions[i * 3]
    const localMercY = positions[i * 3 + 1]

    // Absolute Mercator position (for lng/lat lookup)
    const mercX = localMercX + centerX
    const mercY = localMercY + centerY

    // Convert to lng/lat for interpolation purposes
    const merc = new maplibregl.MercatorCoordinate(mercX, mercY, 0)
    const lngLat = merc.toLngLat()
    lngLatCoords.push([lngLat.lng, lngLat.lat])

    // Store vertex in METERS, centered at origin
    // The model matrix will translate and scale to Mercator
    positions[i * 3] = localMercX / config.meterScale      // meters from center
    // Three.js convention: +Y is "north" in our local ENU model space.
    // Web Mercator: +Y increases towards the south, so invert here.
    positions[i * 3 + 1] = -localMercY / config.meterScale // meters from center (north-positive)
    positions[i * 3 + 2] = 10  // 10 meters above ground
  }

  geometry.attributes.position.needsUpdate = true

  // Create vertex colors (initially grey for unscored)
  const colors = new Float32Array(vertexCount * 3)
  const greyColor = new THREE.Color(0xcccccc)
  for (let i = 0; i < vertexCount; i++) {
    colors[i * 3] = greyColor.r
    colors[i * 3 + 1] = greyColor.g
    colors[i * 3 + 2] = greyColor.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  // Material with vertex colors - use BasicMaterial first to eliminate lighting issues
  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(geometry, material)

  // Store config and lng/lat coords for later use in updates
  mesh.userData.terrainConfig = config
  mesh.userData.lngLatCoords = lngLatCoords

  return mesh
}

/**
 * Update terrain mesh vertex heights and colors based on attractors using Euclidean distance.
 *
 * This is the main function for updating the terrain visualization in Grid mode.
 * It calculates accessibility scores for each vertex using Euclidean distance to attractors,
 * then updates vertex heights and colors accordingly.
 *
 * @param mesh - The terrain mesh to update
 * @param attractors - Array of grid attractors (amenities)
 * @param decayFn - Distance decay function
 * @returns Object with min, max, avg statistics for the Legend
 */
export function updateTerrainFromAttractors(
  mesh: THREE.Mesh,
  attractors: GridAttractor[],
  decayFn: (distance: number) => number
): { min: number; max: number; avg: number } {
  const geometry = mesh.geometry as THREE.BufferGeometry
  const positions = geometry.attributes.position.array as Float32Array
  const colors = geometry.attributes.color.array as Float32Array
  const config = mesh.userData.terrainConfig as TerrainMeshConfig
  const lngLatCoords = mesh.userData.lngLatCoords as [number, number][]

  const vertexCount = (config.segmentsX + 1) * (config.segmentsY + 1)

  // Calculate scores for all vertices using Euclidean distance
  const { rawScores, normalizedScores, min, max, avg } = calculateTerrainScores(
    lngLatCoords,
    attractors,
    decayFn
  )


  // Grey color for areas with no data
  const greyColor = new THREE.Color(0xcccccc)

  // Update heights and colors
  for (let i = 0; i < vertexCount; i++) {
    // Set height based on raw score
    // Use TERRAIN_HEIGHT_SCALE to convert score to meters
    // The mesh is already in meters, so we just add the height
    const heightMeters = rawScores[i] * TERRAIN_HEIGHT_SCALE

    // Position Z is the height in meters
    positions[i * 3 + 2] = heightMeters + 10 // Add 10m base height to stay above ground

    // Set color based on normalized score
    if (attractors.length === 0 || rawScores[i] === 0) {
      colors[i * 3] = greyColor.r
      colors[i * 3 + 1] = greyColor.g
      colors[i * 3 + 2] = greyColor.b
    } else {
      const color = getColorForScore(normalizedScores[i])
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
  }

  geometry.attributes.position.needsUpdate = true
  geometry.attributes.color.needsUpdate = true
  geometry.computeVertexNormals()

  return { min, max, avg }
}

/**
 * Reset terrain mesh to flat ground with grey color
 */
export function resetTerrainMesh(mesh: THREE.Mesh): void {
  const geometry = mesh.geometry as THREE.BufferGeometry
  const positions = geometry.attributes.position.array as Float32Array
  const colors = geometry.attributes.color.array as Float32Array
  const config = mesh.userData.terrainConfig as TerrainMeshConfig
  const vertexCount = (config.segmentsX + 1) * (config.segmentsY + 1)

  const greyColor = new THREE.Color(0xcccccc)

  for (let i = 0; i < vertexCount; i++) {
    positions[i * 3 + 2] = 10 // Reset to base height (10m above ground)
    colors[i * 3] = greyColor.r
    colors[i * 3 + 1] = greyColor.g
    colors[i * 3 + 2] = greyColor.b
  }

  geometry.attributes.position.needsUpdate = true
  geometry.attributes.color.needsUpdate = true
  geometry.computeVertexNormals()
}

/**
 * Create a wireframe grid overlay for the terrain mesh using SDF line rendering.
 * Uses the same smooth anti-aliased SDF shader as the street network.
 *
 * The grid consists of horizontal and vertical lines connecting vertices,
 * creating a visible mesh structure on top of the colored terrain surface.
 *
 * @param terrainMesh - The terrain mesh to create wireframe for
 * @param color - Line color (default: black)
 * @param opacity - Line opacity (default: 0.3)
 * @param lineWidth - Line width in pixels (default: 1)
 * @returns Mesh object with SDF line material to add to the scene
 */
export function createTerrainWireframe(
  terrainMesh: THREE.Mesh,
  color: number = 0x000000,
  opacity: number = 0.3,
  lineWidth: number = 1
): THREE.Mesh {
  const geometry = terrainMesh.geometry as THREE.BufferGeometry
  const positions = geometry.attributes.position.array as Float32Array
  const config = terrainMesh.userData.terrainConfig as TerrainMeshConfig

  const segmentsX = config.segmentsX  // 64
  const segmentsY = config.segmentsY  // 64
  const verticesPerRow = segmentsX + 1  // 65

  // Build segments array for SDF geometry
  const segments: Array<{ start: [number, number, number]; end: [number, number, number] }> = []

  // Build horizontal lines (along X direction)
  for (let y = 0; y <= segmentsY; y++) {
    for (let x = 0; x < segmentsX; x++) {
      // Line from vertex (x, y) to vertex (x+1, y)
      const i1 = y * verticesPerRow + x
      const i2 = y * verticesPerRow + (x + 1)

      segments.push({
        start: [positions[i1 * 3 + 0], positions[i1 * 3 + 1], positions[i1 * 3 + 2]],
        end: [positions[i2 * 3 + 0], positions[i2 * 3 + 1], positions[i2 * 3 + 2]]
      })
    }
  }

  // Build vertical lines (along Y direction)
  for (let y = 0; y < segmentsY; y++) {
    for (let x = 0; x <= segmentsX; x++) {
      // Line from vertex (x, y) to vertex (x, y+1)
      const i1 = y * verticesPerRow + x
      const i2 = (y + 1) * verticesPerRow + x

      segments.push({
        start: [positions[i1 * 3 + 0], positions[i1 * 3 + 1], positions[i1 * 3 + 2]],
        end: [positions[i2 * 3 + 0], positions[i2 * 3 + 1], positions[i2 * 3 + 2]]
      })
    }
  }

  // Create SDF line geometry
  const sdfGeometry = createSDFLineGeometry(segments)

  // Create SDF line material with smooth anti-aliased edges
  const material = new SDFLineMaterial({
    color,
    opacity,
    linewidth: lineWidth
  })

  const wireframe = new THREE.Mesh(sdfGeometry, material)
  wireframe.frustumCulled = false

  // Store reference to terrain config for updates
  wireframe.userData.terrainConfig = config

  return wireframe
}

/**
 * Update wireframe positions to match the terrain mesh.
 * Call this after updating terrain vertex positions.
 *
 * @param wireframe - The wireframe Mesh with SDF geometry
 * @param terrainMesh - The terrain mesh with updated positions
 */
export function updateWireframePositions(
  wireframe: THREE.Mesh,
  terrainMesh: THREE.Mesh
): void {
  const terrainGeometry = terrainMesh.geometry as THREE.BufferGeometry
  const terrainPositions = terrainGeometry.attributes.position.array as Float32Array

  const config = terrainMesh.userData.terrainConfig as TerrainMeshConfig
  const segmentsX = config.segmentsX
  const segmentsY = config.segmentsY
  const verticesPerRow = segmentsX + 1

  // Build updated segments array
  const segments: Array<{ start: [number, number, number]; end: [number, number, number] }> = []

  // Update horizontal lines
  for (let y = 0; y <= segmentsY; y++) {
    for (let x = 0; x < segmentsX; x++) {
      const i1 = y * verticesPerRow + x
      const i2 = y * verticesPerRow + (x + 1)

      segments.push({
        start: [terrainPositions[i1 * 3 + 0], terrainPositions[i1 * 3 + 1], terrainPositions[i1 * 3 + 2]],
        end: [terrainPositions[i2 * 3 + 0], terrainPositions[i2 * 3 + 1], terrainPositions[i2 * 3 + 2]]
      })
    }
  }

  // Update vertical lines
  for (let y = 0; y < segmentsY; y++) {
    for (let x = 0; x <= segmentsX; x++) {
      const i1 = y * verticesPerRow + x
      const i2 = (y + 1) * verticesPerRow + x

      segments.push({
        start: [terrainPositions[i1 * 3 + 0], terrainPositions[i1 * 3 + 1], terrainPositions[i1 * 3 + 2]],
        end: [terrainPositions[i2 * 3 + 0], terrainPositions[i2 * 3 + 1], terrainPositions[i2 * 3 + 2]]
      })
    }
  }

  // Update SDF line geometry
  const geometry = wireframe.geometry as THREE.InstancedBufferGeometry
  updateSDFLineGeometry(geometry, segments)
}

/**
 * Convert lng/lat to local meters (same coordinate system as terrain mesh)
 */
function lngLatToLocalMeters(
  lngLat: [number, number],
  config: TerrainMeshConfig
): { x: number; y: number } {
  // Convert to Mercator
  const merc = maplibregl.MercatorCoordinate.fromLngLat(lngLat)

  // Get center Mercator position
  const centerX = (config.mercatorMinX + config.mercatorMaxX) / 2
  const centerY = (config.mercatorMinY + config.mercatorMaxY) / 2

  // Local position in Mercator units
  const localMercX = merc.x - centerX
  const localMercY = merc.y - centerY

  // Convert to meters (same formula as createTerrainMesh)
  return {
    x: localMercX / config.meterScale,
    y: -localMercY / config.meterScale  // Inverted for north-positive
  }
}

/**
 * Sample terrain height at lng/lat using bilinear interpolation.
 *
 * @param lngLat - Longitude/latitude coordinates
 * @param terrainMesh - The terrain mesh with height data
 * @returns Height in meters at the given location
 */
export function sampleTerrainHeight(
  lngLat: [number, number],
  terrainMesh: THREE.Mesh
): number {
  const config = terrainMesh.userData.terrainConfig as TerrainMeshConfig
  const positions = (terrainMesh.geometry as THREE.BufferGeometry)
    .attributes.position.array as Float32Array

  // Normalize lng/lat to 0-1 within terrain bounds
  const normX = (lngLat[0] - config.minLng) / (config.maxLng - config.minLng)
  const normY = (lngLat[1] - config.minLat) / (config.maxLat - config.minLat)

  // Clamp to terrain bounds
  const clampedX = Math.max(0, Math.min(1, normX))
  const clampedY = Math.max(0, Math.min(1, normY))

  // Map to grid indices (0-64 for 65 vertices)
  const gridX = clampedX * config.segmentsX
  const gridY = clampedY * config.segmentsY

  // Get surrounding vertex indices
  const x0 = Math.floor(gridX)
  const x1 = Math.min(x0 + 1, config.segmentsX)
  const y0 = Math.floor(gridY)
  const y1 = Math.min(y0 + 1, config.segmentsY)

  // Fractional position for interpolation
  const fx = gridX - x0
  const fy = gridY - y0

  // Get heights from 4 corners (Z is at index * 3 + 2)
  const verticesPerRow = config.segmentsX + 1
  const h00 = positions[(y0 * verticesPerRow + x0) * 3 + 2]
  const h10 = positions[(y0 * verticesPerRow + x1) * 3 + 2]
  const h01 = positions[(y1 * verticesPerRow + x0) * 3 + 2]
  const h11 = positions[(y1 * verticesPerRow + x1) * 3 + 2]

  // Bilinear interpolation
  const h0 = h00 * (1 - fx) + h10 * fx
  const h1 = h01 * (1 - fx) + h11 * fx
  return h0 * (1 - fy) + h1 * fy
}

/**
 * Create street network as a THREE.Mesh with SDF (Signed Distance Field) line rendering.
 * Uses custom shaders to achieve smooth anti-aliased lines that look good at any scale.
 *
 * The SDF technique expands line segments into screen-aligned quads and uses
 * smoothstep in the fragment shader to create soft edges, similar to MapLibre's
 * line rendering.
 *
 * @param terrainMesh - The terrain mesh to sample heights from
 * @param graph - Street graph with nodes and edges
 * @param color - Line color (default: white)
 * @param opacity - Line opacity (default: 0.9)
 * @param zOffset - Height offset above terrain in meters (default: 3)
 * @param lineWidth - Line width in pixels (default: 3)
 * @returns Mesh object with SDF line material to add to the scene
 */
export function createStreetNetworkLines(
  terrainMesh: THREE.Mesh,
  graph: StreetGraph,
  color: number = STREET_NETWORK_COLOR,
  opacity: number = 0.9,
  zOffset: number = STREET_NETWORK_Z_OFFSET,
  lineWidth: number = 3  // Increased from 2 to 3 for better visibility with SDF
): THREE.Mesh {
  const config = terrainMesh.userData.terrainConfig as TerrainMeshConfig

  // Extract unique edges (avoid duplicates from bidirectional adjacency)
  const visitedEdges = new Set<string>()
  const lngLatSegments: Array<{ from: [number, number]; to: [number, number] }> = []

  for (const [fromId, edges] of graph.adjacency) {
    for (const edge of edges) {
      const edgeKey = [fromId, edge.to].sort().join('-')
      if (!visitedEdges.has(edgeKey)) {
        visitedEdges.add(edgeKey)
        const fromNode = graph.nodes.get(fromId)
        const toNode = graph.nodes.get(edge.to)
        if (fromNode && toNode) {
          lngLatSegments.push({ from: fromNode.coord, to: toNode.coord })
        }
      }
    }
  }

  // Build segments array for SDF geometry
  const segments: Array<{ start: [number, number, number]; end: [number, number, number] }> = []

  for (let i = 0; i < lngLatSegments.length; i++) {
    const { from, to } = lngLatSegments[i]

    // Convert lng/lat to local meters (same as terrain mesh)
    const fromPos = lngLatToLocalMeters(from, config)
    const toPos = lngLatToLocalMeters(to, config)

    // Sample terrain height + offset
    const fromZ = sampleTerrainHeight(from, terrainMesh) + zOffset
    const toZ = sampleTerrainHeight(to, terrainMesh) + zOffset

    segments.push({
      start: [fromPos.x, fromPos.y, fromZ],
      end: [toPos.x, toPos.y, toZ]
    })
  }

  // Create SDF line geometry (instanced quads for each segment)
  const geometry = createSDFLineGeometry(segments)

  // Create SDF line material with smooth anti-aliased edges
  const material = new SDFLineMaterial({
    color,
    opacity,
    linewidth: lineWidth
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false

  // Store segment data for updates
  mesh.userData.lngLatSegments = lngLatSegments
  mesh.userData.zOffset = zOffset
  mesh.userData.terrainConfig = config

  return mesh
}

/**
 * Update street network heights after terrain changes.
 *
 * @param streetLines - The street network mesh with SDF geometry
 * @param terrainMesh - The terrain mesh with updated heights
 * @param graph - Street graph (not used directly, stored in streetLines.userData)
 * @param zOffset - Height offset above terrain in meters
 */
export function updateStreetNetworkHeights(
  streetLines: THREE.Mesh,
  terrainMesh: THREE.Mesh,
  _graph: StreetGraph,
  zOffset: number = STREET_NETWORK_Z_OFFSET
): void {
  const lngLatSegments = streetLines.userData.lngLatSegments as Array<{ from: [number, number]; to: [number, number] }>
  const config = streetLines.userData.terrainConfig as TerrainMeshConfig

  // Build new segments array with updated heights
  const segments: Array<{ start: [number, number, number]; end: [number, number, number] }> = []

  for (let i = 0; i < lngLatSegments.length; i++) {
    const { from, to } = lngLatSegments[i]

    // Convert lng/lat to local meters
    const fromPos = lngLatToLocalMeters(from, config)
    const toPos = lngLatToLocalMeters(to, config)

    // Sample terrain height + offset
    const fromZ = sampleTerrainHeight(from, terrainMesh) + zOffset
    const toZ = sampleTerrainHeight(to, terrainMesh) + zOffset

    segments.push({
      start: [fromPos.x, fromPos.y, fromZ],
      end: [toPos.x, toPos.y, toZ]
    })
  }

  // Update SDF line geometry
  const geometry = streetLines.geometry as THREE.InstancedBufferGeometry
  updateSDFLineGeometry(geometry, segments)
}

// ============================================================================
// Attractor Pin 3D Visualization
// ============================================================================

// Pin constants
const PIN_HEIGHT_OFFSET = 5  // Height above terrain in meters
const PIN_GROUND_LEVEL = 10  // Ground level (same as terrain base)

/**
 * Calculate pin scale based on attractivity (min 0.8, max 2.0)
 */
export function getPinScale(attractivity: number): number {
  const minScale = 0.8
  const maxScale = 2.0
  if (attractivity <= 0) return minScale
  const sqrtScale = 0.6 + 0.4 * Math.sqrt(attractivity)
  return Math.min(maxScale, Math.max(minScale, sqrtScale))
}

/**
 * Create a connecting line from pin to ground using SDF line material.
 *
 * @param localPos - Local position in meters {x, y}
 * @param topZ - Top of line (terrain height + pin offset)
 * @param bottomZ - Bottom of line (ground level)
 * @returns THREE.Mesh with SDF line geometry
 */
function createConnectingLine(
  localPos: { x: number; y: number },
  topZ: number,
  bottomZ: number
): THREE.Mesh {
  const segments = [{
    start: [localPos.x, localPos.y, topZ] as [number, number, number],
    end: [localPos.x, localPos.y, bottomZ] as [number, number, number]
  }]

  const geometry = createSDFLineGeometry(segments)
  const material = new SDFLineMaterial({
    color: 0x000000,
    linewidth: 2,
    opacity: 1.0
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false

  return mesh
}

/**
 * Data structure for a single attractor pin (connecting line only; pin is HTML overlay)
 */
export interface AttractorPinData {
  id: string
  sprite: THREE.Mesh | null  // null - 3D pin replaced by HTML overlay
  line: THREE.Mesh
  coord: [number, number]
  attractivity: number
}

/**
 * Create 3D attractor pins for all grid attractors.
 * Now only creates connecting lines - the pin visual is an HTML overlay.
 *
 * @param attractors - Array of grid attractors
 * @param terrainMesh - The terrain mesh to sample heights from
 * @returns THREE.Group containing lines, plus pin data for updates
 */
export function createAttractorPins(
  attractors: GridAttractor[],
  terrainMesh: THREE.Mesh
): { group: THREE.Group; pinData: Map<string, AttractorPinData> } {
  const group = new THREE.Group()
  const pinData = new Map<string, AttractorPinData>()
  const config = terrainMesh.userData.terrainConfig as TerrainMeshConfig

  for (const attractor of attractors) {
    // Convert lng/lat to local meters
    const localPos = lngLatToLocalMeters(attractor.coord, config)

    // Sample terrain height at attractor position
    const terrainHeight = sampleTerrainHeight(attractor.coord, terrainMesh)

    // Calculate pin position (above terrain)
    const pinZ = terrainHeight + PIN_HEIGHT_OFFSET

    // Create connecting line from terrain height to ground
    // (the pin SVG is now an HTML overlay positioned via 3D projection)
    const lineTopZ = pinZ
    const line = createConnectingLine(localPos, lineTopZ, PIN_GROUND_LEVEL)

    group.add(line)

    pinData.set(attractor.id, {
      id: attractor.id,
      sprite: null,  // Pin is now HTML overlay
      line,
      coord: attractor.coord,
      attractivity: attractor.attractivity
    })
  }

  return { group, pinData }
}

/**
 * Update attractor pin positions after terrain changes.
 *
 * @param pinData - Map of pin data from createAttractorPins
 * @param terrainMesh - The terrain mesh with updated heights
 */
export function updateAttractorPinHeights(
  pinData: Map<string, AttractorPinData>,
  terrainMesh: THREE.Mesh
): void {
  const config = terrainMesh.userData.terrainConfig as TerrainMeshConfig

  for (const data of pinData.values()) {
    // Convert lng/lat to local meters
    const localPos = lngLatToLocalMeters(data.coord, config)

    // Sample new terrain height
    const terrainHeight = sampleTerrainHeight(data.coord, terrainMesh)
    const pinZ = terrainHeight + PIN_HEIGHT_OFFSET

    // Update connecting line (pin position is handled by HTML overlay via screen projection)
    const lineTopZ = pinZ
    const segments = [{
      start: [localPos.x, localPos.y, lineTopZ] as [number, number, number],
      end: [localPos.x, localPos.y, PIN_GROUND_LEVEL] as [number, number, number]
    }]
    const geometry = data.line.geometry as THREE.InstancedBufferGeometry
    updateSDFLineGeometry(geometry, segments)
  }
}

/**
 * Sync attractor pins with current attractor state.
 * Now only manages connecting lines - pin visuals are HTML overlays.
 *
 * @param group - The THREE.Group containing all lines
 * @param pinData - Current pin data map
 * @param attractors - Current array of grid attractors
 * @param terrainMesh - The terrain mesh to sample heights from
 * @returns Updated pin data map
 */
export function syncAttractorPins(
  group: THREE.Group,
  pinData: Map<string, AttractorPinData>,
  attractors: GridAttractor[],
  terrainMesh: THREE.Mesh
): Map<string, AttractorPinData> {
  const config = terrainMesh.userData.terrainConfig as TerrainMeshConfig
  const currentIds = new Set(attractors.map(a => a.id))
  const existingIds = new Set(pinData.keys())

  // Remove deleted pins
  for (const id of existingIds) {
    if (!currentIds.has(id)) {
      const data = pinData.get(id)!
      // Sprite may be null if using HTML overlay
      if (data.sprite) {
        group.remove(data.sprite)
        data.sprite.geometry?.dispose()
        if (data.sprite.material instanceof THREE.MeshBasicMaterial) {
          data.sprite.material.dispose()
        }
      }
      group.remove(data.line)
      data.line.geometry.dispose()
      ;(data.line.material as THREE.Material).dispose()
      pinData.delete(id)
    }
  }

  // Add or update pins
  for (const attractor of attractors) {
    const existing = pinData.get(attractor.id)

    // Convert lng/lat to local meters
    const localPos = lngLatToLocalMeters(attractor.coord, config)

    // Sample terrain height at attractor position
    const terrainHeight = sampleTerrainHeight(attractor.coord, terrainMesh)
    const pinZ = terrainHeight + PIN_HEIGHT_OFFSET

    if (!existing) {
      // Create connecting line only (pin is HTML overlay)
      const lineTopZ = pinZ
      const line = createConnectingLine(localPos, lineTopZ, PIN_GROUND_LEVEL)

      group.add(line)

      pinData.set(attractor.id, {
        id: attractor.id,
        sprite: null,  // Pin is HTML overlay
        line,
        coord: attractor.coord,
        attractivity: attractor.attractivity
      })
    } else {
      // Update existing pin position
      const coordChanged = existing.coord[0] !== attractor.coord[0] || existing.coord[1] !== attractor.coord[1]
      const attractivityChanged = existing.attractivity !== attractor.attractivity

      if (coordChanged || attractivityChanged) {
        // Update connecting line
        const lineTopZ = pinZ
        const segments = [{
          start: [localPos.x, localPos.y, lineTopZ] as [number, number, number],
          end: [localPos.x, localPos.y, PIN_GROUND_LEVEL] as [number, number, number]
        }]
        const geometry = existing.line.geometry as THREE.InstancedBufferGeometry
        updateSDFLineGeometry(geometry, segments)

        // Update stored data
        existing.coord = attractor.coord
        existing.attractivity = attractor.attractivity
      }
    }
  }

  return pinData
}
