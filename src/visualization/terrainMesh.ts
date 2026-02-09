import * as THREE from 'three'
import maplibregl from 'maplibre-gl'
import type { StreetGraph, GridAttractor, DistanceMatrix, DistanceMode } from '../config/types'
import { DEGREES_TO_METERS, TERRAIN_SEGMENTS, TERRAIN_HEIGHT_SCALE, TERRAIN_CONTOUR_COUNT, TERRAIN_SMOOTH_SIGMA } from '../config/constants'
import { calculateTerrainScores } from '../computation/terrainAccessibilityCalc'
import { SDFLineMaterial, createSDFLineGeometry, updateSDFLineGeometry } from './SDFLineMaterial'
import { TerrainColorMaterial } from './TerrainColorMaterial'
import { findNearestNode } from '../data/streetGraph'

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

// ============================================================================
// Terrain Smoothing (Gaussian Blur)
// ============================================================================

/**
 * Generate a 1D Gaussian kernel for separable convolution.
 *
 * @param sigma - Standard deviation of the Gaussian
 * @param radius - Kernel radius (kernel size = 2*radius + 1)
 * @returns Normalized kernel values
 */
function generateGaussianKernel(sigma: number, radius: number): Float32Array {
  const size = radius * 2 + 1
  const kernel = new Float32Array(size)
  const sigma2 = sigma * sigma
  let sum = 0

  for (let i = 0; i < size; i++) {
    const x = i - radius
    const value = Math.exp(-(x * x) / (2 * sigma2))
    kernel[i] = value
    sum += value
  }

  // Normalize
  for (let i = 0; i < size; i++) {
    kernel[i] /= sum
  }

  return kernel
}

/**
 * Apply 1D convolution along a single axis.
 *
 * @param input - Input array
 * @param width - Grid width
 * @param height - Grid height
 * @param kernel - 1D kernel values
 * @param horizontal - True for horizontal pass, false for vertical
 * @returns Convolved array
 */
function convolve1D(
  input: Float32Array,
  width: number,
  height: number,
  kernel: Float32Array,
  horizontal: boolean
): Float32Array {
  const output = new Float32Array(input.length)
  const radius = (kernel.length - 1) / 2

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let weightSum = 0

      for (let k = -radius; k <= radius; k++) {
        let sampleX = x
        let sampleY = y

        if (horizontal) {
          sampleX = x + k
        } else {
          sampleY = y + k
        }

        // Clamp to boundaries (replicate edge)
        sampleX = Math.max(0, Math.min(width - 1, sampleX))
        sampleY = Math.max(0, Math.min(height - 1, sampleY))

        const idx = sampleY * width + sampleX
        const weight = kernel[k + radius]
        sum += input[idx] * weight
        weightSum += weight
      }

      output[y * width + x] = sum / weightSum
    }
  }

  return output
}

/**
 * Apply Gaussian blur to a 2D array of scores using separable convolution.
 *
 * This smooths the terrain by reducing sharp transitions between adjacent
 * vertices that may be mapped to different network nodes.
 *
 * @param scores - Float32Array of normalized scores (0-1)
 * @param width - Grid width (65)
 * @param height - Grid height (65)
 * @param sigma - Blur radius in grid cells (default: 1.5)
 * @returns Smoothed Float32Array
 */
function smoothScores(
  scores: Float32Array,
  width: number,
  height: number,
  sigma: number
): Float32Array {
  // Skip smoothing if sigma is 0 or too small
  if (sigma < 0.1) {
    return scores
  }

  // Generate Gaussian kernel (radius = ceil(2*sigma) to capture ~95% of distribution)
  const radius = Math.ceil(sigma * 2)
  const kernel = generateGaussianKernel(sigma, radius)

  // Apply separable convolution (horizontal then vertical)
  const temp = convolve1D(scores, width, height, kernel, true)  // horizontal pass
  return convolve1D(temp, width, height, kernel, false)         // vertical pass
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
 *
 * @param config - Terrain mesh configuration with bounds and resolution
 * @param graph - Street graph for mapping vertices to nearest network nodes
 */
export function createTerrainMesh(config: TerrainMeshConfig, graph: StreetGraph): THREE.Mesh {
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
    positions[i * 3 + 2] = 0  // ground level
  }

  geometry.attributes.position.needsUpdate = true

  // Create score attribute for per-vertex accessibility scores (used by shader)
  // This enables sharp filter boundaries by making the color decision per-pixel
  const scores = new Float32Array(vertexCount)
  // Initialize all scores to 0 (will be updated when attractors are added)
  for (let i = 0; i < vertexCount; i++) {
    scores[i] = 0
  }
  geometry.setAttribute('score', new THREE.BufferAttribute(scores, 1))

  // Use custom TerrainColorMaterial for sharp filter boundaries
  // This material computes colors per-pixel based on the interpolated score,
  // rather than interpolating vertex colors (which creates blurry boundaries)
  const material = new TerrainColorMaterial()

  const mesh = new THREE.Mesh(geometry, material)

  // Store config and lng/lat coords for later use in updates
  mesh.userData.terrainConfig = config
  mesh.userData.lngLatCoords = lngLatCoords

  // Map each vertex to its nearest network node for network distance lookup
  const vertexNodeIds: string[] = new Array(lngLatCoords.length)
  for (let i = 0; i < lngLatCoords.length; i++) {
    vertexNodeIds[i] = findNearestNode(graph, lngLatCoords[i])
  }
  mesh.userData.vertexNodeIds = vertexNodeIds

  return mesh
}

/**
 * Update terrain mesh vertex heights and colors based on attractors using network distance.
 *
 * This is the main function for updating the terrain visualization in Grid mode.
 * It calculates accessibility scores for each vertex using network distance to attractors,
 * then updates vertex heights and colors accordingly.
 *
 * @param mesh - The terrain mesh to update
 * @param attractors - Array of grid attractors (amenities)
 * @param decayFn - Distance decay function
 * @param distanceMatrix - Full network distance matrix (all nodes to all nodes)
 * @param smoothingSigma - Gaussian blur sigma for terrain smoothing (default: TERRAIN_SMOOTH_SIGMA)
 * @param heightScale - Maximum terrain height in meters (default: TERRAIN_HEIGHT_SCALE)
 * @param fixedRange - Optional fixed range for color normalization
 * @param filterRange - Optional filter range to grey out areas outside the range
 * @returns Object with min, max, avg statistics for the Legend
 */
export function updateTerrainFromAttractors(
  mesh: THREE.Mesh,
  attractors: GridAttractor[],
  decayFn: (distance: number) => number,
  distanceMatrix: DistanceMatrix,
  smoothingSigma: number = TERRAIN_SMOOTH_SIGMA,
  heightScale: number = TERRAIN_HEIGHT_SCALE,
  fixedRange?: { min: number; max: number },
  filterRange?: { minPercent: number; maxPercent: number } | null,
  distanceMode?: DistanceMode
): { min: number; max: number; avg: number } {
  const geometry = mesh.geometry as THREE.BufferGeometry
  const positions = geometry.attributes.position.array as Float32Array
  const scoreAttr = geometry.attributes.score.array as Float32Array
  const config = mesh.userData.terrainConfig as TerrainMeshConfig
  const vertexNodeIds = mesh.userData.vertexNodeIds as string[]
  const lngLatCoords = mesh.userData.lngLatCoords as [number, number][]

  const vertexCount = (config.segmentsX + 1) * (config.segmentsY + 1)

  // Calculate scores for all vertices
  const { normalizedScores, min, max, avg } = calculateTerrainScores(
    vertexNodeIds,
    attractors,
    decayFn,
    distanceMatrix,
    fixedRange,
    distanceMode,
    distanceMode === 'euclidean' ? lngLatCoords : undefined
  )

  // Apply Gaussian smoothing to reduce sharp transitions at network node boundaries
  const gridWidth = config.segmentsX + 1   // 65
  const gridHeight = config.segmentsY + 1  // 65
  const normalizedScoresArray = new Float32Array(normalizedScores)
  const smoothedScores = smoothScores(normalizedScoresArray, gridWidth, gridHeight, smoothingSigma)

  // Update heights and scores (colors are computed per-pixel in the shader)
  for (let i = 0; i < vertexCount; i++) {
    // Set height based on smoothed normalized score (0-1 range)
    // This ensures terrain height is always in [0, heightScale] range
    // regardless of attractor weights, matching how colors are normalized
    const heightMeters = smoothedScores[i] * heightScale

    // Position Z is the height in meters
    positions[i * 3 + 2] = heightMeters // terrain height only, no base offset

    // Set score attribute (shader will compute color per-pixel for sharp filter boundaries)
    scoreAttr[i] = smoothedScores[i]
  }

  geometry.attributes.position.needsUpdate = true
  geometry.attributes.score.needsUpdate = true
  geometry.computeVertexNormals()

  // Update material settings for filter and attractor state
  const material = mesh.material as TerrainColorMaterial
  material.setHasAttractors(attractors.length > 0)
  if (filterRange) {
    material.setFilterRange(filterRange.minPercent, filterRange.maxPercent, true)
  } else {
    material.setFilterRange(0, 1, false)
  }

  return { min, max, avg }
}

/**
 * Reset terrain mesh to flat ground with grey color
 */
export function resetTerrainMesh(mesh: THREE.Mesh): void {
  const geometry = mesh.geometry as THREE.BufferGeometry
  const positions = geometry.attributes.position.array as Float32Array
  const scoreAttr = geometry.attributes.score.array as Float32Array
  const config = mesh.userData.terrainConfig as TerrainMeshConfig
  const vertexCount = (config.segmentsX + 1) * (config.segmentsY + 1)

  for (let i = 0; i < vertexCount; i++) {
    positions[i * 3 + 2] = 0 // Reset to ground level
    scoreAttr[i] = 0 // Reset score to 0
  }

  geometry.attributes.position.needsUpdate = true
  geometry.attributes.score.needsUpdate = true

  // Reset material state
  const material = mesh.material as TerrainColorMaterial
  material.setHasAttractors(false)
  material.setFilterRange(0, 1, false)
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
 * Convert local model-space meters back to lng/lat (inverse of lngLatToLocalMeters).
 */
export function localMetersToLngLat(
  pos: { x: number; y: number },
  config: TerrainMeshConfig
): [number, number] {
  const centerX = (config.mercatorMinX + config.mercatorMaxX) / 2
  const centerY = (config.mercatorMinY + config.mercatorMaxY) / 2

  const mercX = pos.x * config.meterScale + centerX
  const mercY = -pos.y * config.meterScale + centerY

  const coord = new maplibregl.MercatorCoordinate(mercX, mercY, 0)
  const lngLat = coord.toLngLat()
  return [lngLat.lng, lngLat.lat]
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
 * Sample terrain normalized score at lng/lat using bilinear interpolation.
 * Returns the smoothed normalized score (0-1) from the `score` BufferAttribute.
 * Returns -1 if the point is outside terrain bounds.
 *
 * @param lngLat - Longitude/latitude coordinates
 * @param terrainMesh - The terrain mesh with score data
 * @returns Normalized score (0-1) or -1 if outside bounds
 */
export function sampleTerrainScore(
  lngLat: [number, number],
  terrainMesh: THREE.Mesh
): number {
  const config = terrainMesh.userData.terrainConfig as TerrainMeshConfig
  const scoreArray = (terrainMesh.geometry as THREE.BufferGeometry)
    .attributes.score?.array as Float32Array | undefined

  if (!scoreArray) return -1

  // Normalize lng/lat to 0-1 within terrain bounds
  const normX = (lngLat[0] - config.minLng) / (config.maxLng - config.minLng)
  const normY = (lngLat[1] - config.minLat) / (config.maxLat - config.minLat)

  // Return -1 if outside terrain bounds
  if (normX < 0 || normX > 1 || normY < 0 || normY > 1) return -1

  // Map to grid indices (0-64 for 65 vertices)
  const gridX = normX * config.segmentsX
  const gridY = normY * config.segmentsY

  // Get surrounding vertex indices
  const x0 = Math.floor(gridX)
  const x1 = Math.min(x0 + 1, config.segmentsX)
  const y0 = Math.floor(gridY)
  const y1 = Math.min(y0 + 1, config.segmentsY)

  // Fractional position for interpolation
  const fx = gridX - x0
  const fy = gridY - y0

  // Get scores from 4 corners (score is a single-component attribute)
  const verticesPerRow = config.segmentsX + 1
  const s00 = scoreArray[y0 * verticesPerRow + x0]
  const s10 = scoreArray[y0 * verticesPerRow + x1]
  const s01 = scoreArray[y1 * verticesPerRow + x0]
  const s11 = scoreArray[y1 * verticesPerRow + x1]

  // Bilinear interpolation
  const s0 = s00 * (1 - fx) + s10 * fx
  const s1 = s01 * (1 - fx) + s11 * fx
  return s0 * (1 - fy) + s1 * fy
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
 * Get pin scale (constant size, attractivity no longer affects pin size)
 */
export function getPinScale(_attractivity: number): number {
  return 1.0
}

// Connecting line visual constants
const CONNECTING_LINE_WIDTH = 3      // pixels
const CONNECTING_LINE_DASH_SIZE = 8  // meters (dash length)
const CONNECTING_LINE_GAP_SIZE = 6   // meters (gap length)

/**
 * Create a connecting line from pin to ground using SDF line material.
 * Line is dashed and thicker for better visibility.
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
    linewidth: CONNECTING_LINE_WIDTH,
    opacity: 1.0,
    dashSize: CONNECTING_LINE_DASH_SIZE,
    gapSize: CONNECTING_LINE_GAP_SIZE
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.renderOrder = 15  // Render on top of everything (streets=10, contours=5)

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

// ============================================================================
// Contour Lines (Marching Squares)
// ============================================================================

// Contour line visual constants
const CONTOUR_OPACITY = 0.9    // high visibility
const CONTOUR_LINE_WIDTH = 1.5 // moderate thickness
const CONTOUR_Z_OFFSET = 0.5   // meters above terrain to prevent z-fighting
const CONTOUR_MIN_REDUCTION = 0.0   // min lightness reduction for dark colors
const CONTOUR_MAX_REDUCTION = 0.15  // max lightness reduction for bright colors

/**
 * Get contour color for a normalized score (0-1)
 * Uses adaptive lightness reduction - darker colors get less reduction,
 * brighter colors get more reduction, to maintain consistent contrast
 */
function getContourColor(score: number): number {
  const color = getColorForScore(score)
  // Get HSL values
  const hsl = { h: 0, s: 0, l: 0 }
  color.getHSL(hsl)
  // Adaptive reduction: scale from MIN_REDUCTION (at L=0) to MAX_REDUCTION (at L=1)
  const reduction = CONTOUR_MIN_REDUCTION + (CONTOUR_MAX_REDUCTION - CONTOUR_MIN_REDUCTION) * hsl.l
  const newLightness = Math.max(0, hsl.l - reduction)
  color.setHSL(hsl.h, hsl.s, newLightness)
  return color.getHex()
}

/**
 * Marching squares edge table.
 *
 * For each of the 16 possible cell configurations (4 corners, each above or below threshold),
 * this table defines which edges have contour crossings.
 *
 * Cell corners are numbered:
 *   3---2
 *   |   |
 *   0---1
 *
 * Edges are numbered:
 *   +--2--+
 *   |     |
 *   3     1
 *   |     |
 *   +--0--+
 *
 * Each entry is an array of edge pairs: [[edge1, edge2], ...] indicating
 * which edges the contour line crosses (from edge1 to edge2).
 *
 * The cell index is computed as: (bit3 << 3) | (bit2 << 2) | (bit1 << 1) | bit0
 * where bitN = 1 if corner N is above the threshold, 0 if below.
 */
const MARCHING_SQUARES_EDGES: number[][][] = [
  [],               // 0:  0000 - all below
  [[0, 3]],         // 1:  0001 - corner 0 above
  [[0, 1]],         // 2:  0010 - corner 1 above
  [[1, 3]],         // 3:  0011 - corners 0,1 above
  [[1, 2]],         // 4:  0100 - corner 2 above
  [[0, 1], [2, 3]], // 5:  0101 - corners 0,2 above (saddle)
  [[0, 2]],         // 6:  0110 - corners 1,2 above
  [[2, 3]],         // 7:  0111 - corners 0,1,2 above
  [[2, 3]],         // 8:  1000 - corner 3 above
  [[0, 2]],         // 9:  1001 - corners 0,3 above
  [[0, 3], [1, 2]], // 10: 1010 - corners 1,3 above (saddle)
  [[1, 2]],         // 11: 1011 - corners 0,1,3 above
  [[1, 3]],         // 12: 1100 - corners 2,3 above
  [[0, 1]],         // 13: 1101 - corners 0,2,3 above
  [[0, 3]],         // 14: 1110 - corners 1,2,3 above
  []                // 15: 1111 - all above
]

/**
 * Get the height value at a cell corner.
 *
 * @param positions - Terrain vertex positions array
 * @param segmentsX - Number of segments in X direction
 * @param x - Cell X index (0 to segmentsX-1)
 * @param y - Cell Y index (0 to segmentsY-1)
 * @param corner - Corner index (0-3)
 * @returns Height at that corner
 */
function getCellCornerHeight(
  positions: Float32Array,
  segmentsX: number,
  x: number,
  y: number,
  corner: number
): number {
  const verticesPerRow = segmentsX + 1

  // Corner vertex offsets
  const cornerOffsets = [
    [0, 0],   // corner 0: bottom-left
    [1, 0],   // corner 1: bottom-right
    [1, 1],   // corner 2: top-right
    [0, 1]    // corner 3: top-left
  ]

  const [dx, dy] = cornerOffsets[corner]
  const vertexIndex = (y + dy) * verticesPerRow + (x + dx)
  return positions[vertexIndex * 3 + 2]  // Z component is height
}

/**
 * Get the XY position at a cell corner.
 *
 * @param positions - Terrain vertex positions array
 * @param segmentsX - Number of segments in X direction
 * @param x - Cell X index
 * @param y - Cell Y index
 * @param corner - Corner index (0-3)
 * @returns [x, y] position in model space
 */
function getCellCornerPosition(
  positions: Float32Array,
  segmentsX: number,
  x: number,
  y: number,
  corner: number
): [number, number] {
  const verticesPerRow = segmentsX + 1

  const cornerOffsets = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1]
  ]

  const [dx, dy] = cornerOffsets[corner]
  const vertexIndex = (y + dy) * verticesPerRow + (x + dx)
  return [positions[vertexIndex * 3], positions[vertexIndex * 3 + 1]]
}

/**
 * Interpolate the position where a contour line crosses an edge.
 *
 * @param positions - Terrain vertex positions array
 * @param segmentsX - Number of segments in X direction
 * @param x - Cell X index
 * @param y - Cell Y index
 * @param edge - Edge index (0-3)
 * @param threshold - Height threshold for the contour
 * @returns [x, y, z] interpolated position
 */
function interpolateEdgeCrossing(
  positions: Float32Array,
  segmentsX: number,
  x: number,
  y: number,
  edge: number,
  threshold: number
): [number, number, number] {
  // Edge to corner mapping
  // Edge 0: corner 0 to corner 1 (bottom)
  // Edge 1: corner 1 to corner 2 (right)
  // Edge 2: corner 2 to corner 3 (top)
  // Edge 3: corner 3 to corner 0 (left)
  const edgeCorners = [
    [0, 1],  // edge 0
    [1, 2],  // edge 1
    [2, 3],  // edge 2
    [3, 0]   // edge 3
  ]

  const [c1, c2] = edgeCorners[edge]

  const h1 = getCellCornerHeight(positions, segmentsX, x, y, c1)
  const h2 = getCellCornerHeight(positions, segmentsX, x, y, c2)

  const p1 = getCellCornerPosition(positions, segmentsX, x, y, c1)
  const p2 = getCellCornerPosition(positions, segmentsX, x, y, c2)

  // Interpolation factor
  let t = 0.5  // fallback for edge cases
  if (Math.abs(h2 - h1) > 0.0001) {
    t = (threshold - h1) / (h2 - h1)
  }
  t = Math.max(0, Math.min(1, t))

  // Interpolated position
  const px = p1[0] + t * (p2[0] - p1[0])
  const py = p1[1] + t * (p2[1] - p1[1])
  const pz = threshold + CONTOUR_Z_OFFSET  // Contour at exact height + offset

  return [px, py, pz]
}

/**
 * Extract contour line segments at a given height threshold.
 *
 * Uses the marching squares algorithm to find all edges where the
 * terrain crosses the specified height.
 *
 * @param positions - Terrain vertex positions array
 * @param segmentsX - Number of segments in X direction
 * @param segmentsY - Number of segments in Y direction
 * @param threshold - Height threshold for the contour
 * @returns Array of line segments
 */
function extractContourAtHeight(
  positions: Float32Array,
  segmentsX: number,
  segmentsY: number,
  threshold: number
): Array<{ start: [number, number, number]; end: [number, number, number] }> {
  const segments: Array<{ start: [number, number, number]; end: [number, number, number] }> = []

  // Process each cell in the grid
  for (let y = 0; y < segmentsY; y++) {
    for (let x = 0; x < segmentsX; x++) {
      // Get heights at cell corners
      const h0 = getCellCornerHeight(positions, segmentsX, x, y, 0)
      const h1 = getCellCornerHeight(positions, segmentsX, x, y, 1)
      const h2 = getCellCornerHeight(positions, segmentsX, x, y, 2)
      const h3 = getCellCornerHeight(positions, segmentsX, x, y, 3)

      // Compute cell configuration index
      const bit0 = h0 >= threshold ? 1 : 0
      const bit1 = h1 >= threshold ? 2 : 0
      const bit2 = h2 >= threshold ? 4 : 0
      const bit3 = h3 >= threshold ? 8 : 0
      const cellIndex = bit0 | bit1 | bit2 | bit3

      // Get edge crossings for this configuration
      const edgePairs = MARCHING_SQUARES_EDGES[cellIndex]

      // Generate line segments for each edge pair
      for (const [edge1, edge2] of edgePairs) {
        const p1 = interpolateEdgeCrossing(positions, segmentsX, x, y, edge1, threshold)
        const p2 = interpolateEdgeCrossing(positions, segmentsX, x, y, edge2, threshold)

        segments.push({ start: p1, end: p2 })
      }
    }
  }

  return segments
}

/**
 * Create contour lines for the terrain mesh.
 *
 * Generates N contour lines at regular height intervals from the minimum
 * to maximum height of the terrain. Each contour level is colored with a
 * darkened version of the terrain gradient at that height.
 *
 * @param terrainMesh - The terrain mesh to create contours for
 * @param numContours - Number of contour lines (default: 10)
 * @param opacity - Line opacity (default: 0.6)
 * @param lineWidth - Line width in pixels (default: 1)
 * @returns Group containing colored contour meshes, or null if no contours
 */
export function createContourLines(
  terrainMesh: THREE.Mesh,
  numContours: number = TERRAIN_CONTOUR_COUNT,
  opacity: number = CONTOUR_OPACITY,
  lineWidth: number = CONTOUR_LINE_WIDTH
): THREE.Group | null {
  const geometry = terrainMesh.geometry as THREE.BufferGeometry
  const positions = geometry.attributes.position.array as Float32Array
  const config = terrainMesh.userData.terrainConfig as TerrainMeshConfig

  const segmentsX = config.segmentsX
  const segmentsY = config.segmentsY
  const vertexCount = (segmentsX + 1) * (segmentsY + 1)

  // Find min and max heights
  let minHeight = Infinity
  let maxHeight = -Infinity
  for (let i = 0; i < vertexCount; i++) {
    const h = positions[i * 3 + 2]
    if (h < minHeight) minHeight = h
    if (h > maxHeight) maxHeight = h
  }

  // If terrain is flat, no contours needed
  if (maxHeight - minHeight < 1) {
    return null
  }

  // Create a group to hold all contour level meshes
  const contourGroup = new THREE.Group()

  // Calculate contour height levels
  // We want N contours between min and max, so we divide into N+1 intervals
  const interval = (maxHeight - minHeight) / (numContours + 1)

  for (let i = 1; i <= numContours; i++) {
    const threshold = minHeight + i * interval
    const contourSegments = extractContourAtHeight(positions, segmentsX, segmentsY, threshold)

    // Skip if no segments at this level
    if (contourSegments.length === 0) continue

    // Calculate normalized score for this height level (0-1)
    const normalizedScore = (threshold - minHeight) / (maxHeight - minHeight)

    // Get darkened gradient color for this level
    const color = getContourColor(normalizedScore)

    // Create SDF line geometry for this level
    const sdfGeometry = createSDFLineGeometry(contourSegments)

    // Create SDF line material with the level's color
    const material = new SDFLineMaterial({
      color,
      opacity,
      linewidth: lineWidth
    })

    const contourMesh = new THREE.Mesh(sdfGeometry, material)
    contourMesh.frustumCulled = false
    contourMesh.renderOrder = 5  // Render behind streets (renderOrder 10)

    // Store the contour level index for updates
    contourMesh.userData.contourLevel = i
    contourMesh.userData.normalizedScore = normalizedScore

    contourGroup.add(contourMesh)
  }

  // If no contours were created, return null
  if (contourGroup.children.length === 0) {
    return null
  }

  // Store config for updates
  contourGroup.userData.terrainConfig = config
  contourGroup.userData.numContours = numContours

  return contourGroup
}

/**
 * Update contour line positions after terrain heights change.
 *
 * Rebuilds all contour level meshes with new positions and colors
 * based on the updated terrain heights.
 *
 * @param contourGroup - The contour lines group to update
 * @param terrainMesh - The terrain mesh with updated heights
 * @param numContours - Number of contour lines (default: 10)
 * @param opacity - Line opacity (default: 0.6)
 * @param lineWidth - Line width in pixels (default: 1)
 */
export function updateContourLines(
  contourGroup: THREE.Group,
  terrainMesh: THREE.Mesh,
  numContours: number = TERRAIN_CONTOUR_COUNT,
  opacity: number = CONTOUR_OPACITY,
  lineWidth: number = CONTOUR_LINE_WIDTH
): void {
  const terrainGeometry = terrainMesh.geometry as THREE.BufferGeometry
  const positions = terrainGeometry.attributes.position.array as Float32Array
  const config = terrainMesh.userData.terrainConfig as TerrainMeshConfig

  const segmentsX = config.segmentsX
  const segmentsY = config.segmentsY
  const vertexCount = (segmentsX + 1) * (segmentsY + 1)

  // Find min and max heights
  let minHeight = Infinity
  let maxHeight = -Infinity
  for (let i = 0; i < vertexCount; i++) {
    const h = positions[i * 3 + 2]
    if (h < minHeight) minHeight = h
    if (h > maxHeight) maxHeight = h
  }

  // Dispose old child meshes
  while (contourGroup.children.length > 0) {
    const child = contourGroup.children[0] as THREE.Mesh
    child.geometry.dispose()
    ;(child.material as THREE.Material).dispose()
    contourGroup.remove(child)
  }

  // If terrain is flat, leave group empty
  if (maxHeight - minHeight < 1) {
    return
  }

  // Calculate contour height levels
  const interval = (maxHeight - minHeight) / (numContours + 1)

  for (let i = 1; i <= numContours; i++) {
    const threshold = minHeight + i * interval
    const contourSegments = extractContourAtHeight(positions, segmentsX, segmentsY, threshold)

    // Skip if no segments at this level
    if (contourSegments.length === 0) continue

    // Calculate normalized score for this height level (0-1)
    const normalizedScore = (threshold - minHeight) / (maxHeight - minHeight)

    // Get darkened gradient color for this level
    const color = getContourColor(normalizedScore)

    // Create SDF line geometry for this level
    const sdfGeometry = createSDFLineGeometry(contourSegments)

    // Create SDF line material with the level's color
    const material = new SDFLineMaterial({
      color,
      opacity,
      linewidth: lineWidth
    })

    const contourMesh = new THREE.Mesh(sdfGeometry, material)
    contourMesh.frustumCulled = false
    contourMesh.renderOrder = 5  // Render behind streets (renderOrder 10)

    // Store the contour level index for updates
    contourMesh.userData.contourLevel = i
    contourMesh.userData.normalizedScore = normalizedScore

    contourGroup.add(contourMesh)
  }
}

// Dark grey color for filtered-out contours
const CONTOUR_FILTERED_COLOR = 0x909090

/**
 * Update contour line colors based on filter range.
 * Contours outside the filter range are colored dark grey.
 *
 * @param contourGroup - The contour lines group
 * @param filterRange - Filter range with minPercent and maxPercent (null = no filter)
 */
export function updateContourFilterColors(
  contourGroup: THREE.Group,
  filterRange: { minPercent: number; maxPercent: number } | null
): void {
  for (const child of contourGroup.children) {
    const contourMesh = child as THREE.Mesh
    const material = contourMesh.material as SDFLineMaterial
    const normalizedScore = contourMesh.userData.normalizedScore as number

    if (filterRange) {
      // Check if this contour level is outside the filter range
      const isFiltered = normalizedScore < filterRange.minPercent || normalizedScore > filterRange.maxPercent
      if (isFiltered) {
        // Set to dark grey for filtered-out contours
        material.uniforms.diffuse.value.setHex(CONTOUR_FILTERED_COLOR)
      } else {
        // Restore original gradient color
        material.uniforms.diffuse.value.setHex(getContourColor(normalizedScore))
      }
    } else {
      // No filter - restore original gradient color
      material.uniforms.diffuse.value.setHex(getContourColor(normalizedScore))
    }
    material.needsUpdate = true
  }
}
