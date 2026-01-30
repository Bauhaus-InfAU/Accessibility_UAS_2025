import * as THREE from 'three'
import maplibregl from 'maplibre-gl'
import type { StreetGraph, GridAttractor } from '../config/types'
import { DEGREES_TO_METERS, TERRAIN_SEGMENTS, TERRAIN_HEIGHT_SCALE } from '../config/constants'
import { calculateTerrainScores } from '../computation/terrainAccessibilityCalc'

export { TERRAIN_SEGMENTS }

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
