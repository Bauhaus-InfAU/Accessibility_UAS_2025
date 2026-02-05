import * as THREE from 'three'
import maplibregl from 'maplibre-gl'
import type { StreetGraph, GridAttractor, DistanceMatrix } from '../config/types'
import {
  createTerrainMesh,
  updateTerrainFromAttractors,
  resetTerrainMesh,
  getGraphBounds,
  createTerrainWireframe,
  updateWireframePositions,
  createStreetNetworkLines,
  updateStreetNetworkHeights,
  syncAttractorPins,
  updateAttractorPinHeights,
  sampleTerrainHeight,
  lngLatToLocalMeters,
  createContourLines,
  updateContourLines,
  type TerrainMeshConfig,
  type AttractorPinData
} from './terrainMesh'
import { SDFLineMaterial } from './SDFLineMaterial'

// Height offset for pins above terrain (in meters)
const PIN_HEIGHT_OFFSET = 5

/**
 * Three.js terrain layer for MapLibre
 *
 * This creates a smooth, continuous terrain mesh using Three.js,
 * rendered as a MapLibre custom layer.
 */

const DEBUG_TERRAIN_LAYER = false

interface ThreeJsTerrainLayerState {
  scene: THREE.Scene
  camera: THREE.Camera
  renderer: THREE.WebGLRenderer
  terrainMesh: THREE.Mesh | null
  wireframeGrid: THREE.Mesh | null  // Mesh with SDF line material
  streetNetworkLines: THREE.Mesh | null  // Mesh with SDF line material
  contourLines: THREE.Group | null  // Group containing colored contour meshes
  attractorPinsGroup: THREE.Group | null  // Group containing all 3D attractor pins
  attractorPinData: Map<string, AttractorPinData>  // Pin data for updates
  graph: StreetGraph | null
  config: TerrainMeshConfig | null
  map: maplibregl.Map | null
  lastCanvasWidth: number
  lastCanvasHeight: number
  visible: boolean
}

// Global state for the layer
let layerState: ThreeJsTerrainLayerState | null = null

// Cached screen positions for attractor pins (computed during render)
let cachedScreenPositions: Map<string, { x: number; y: number; visible: boolean }> = new Map()

// Pin overlay container for HTML pin elements
let pinOverlayContainer: HTMLDivElement | null = null

/**
 * Create a container for HTML pin overlays.
 * This container sits over the map canvas and holds pin SVG elements
 * that are positioned using 3D projection.
 */
export function createPinOverlayContainer(mapContainer: HTMLElement): HTMLDivElement {
  const container = document.createElement('div')
  container.className = 'terrain-pin-overlay'
  container.style.position = 'absolute'
  container.style.top = '0'
  container.style.left = '0'
  container.style.width = '100%'
  container.style.height = '100%'
  container.style.pointerEvents = 'none'
  container.style.overflow = 'hidden'
  container.style.zIndex = '1' // Above map canvas but below MapLibre markers
  mapContainer.appendChild(container)
  pinOverlayContainer = container
  return container
}

/**
 * Get the pin overlay container.
 */
export function getPinOverlayContainer(): HTMLDivElement | null {
  return pinOverlayContainer
}

/**
 * Clean up the pin overlay container.
 */
export function removePinOverlayContainer(): void {
  if (pinOverlayContainer) {
    pinOverlayContainer.remove()
    pinOverlayContainer = null
  }
}

/**
 * Create the Three.js custom layer interface for MapLibre
 */
export function createThreeJsTerrainLayer(
  graph: StreetGraph
): maplibregl.CustomLayerInterface {
  // Calculate bounds from graph (includes Mercator coordinates)
  const config = getGraphBounds(graph)

  return {
    id: 'terrain-3d-threejs',
    type: 'custom',
    renderingMode: '3d',

    onAdd(map: maplibregl.Map, gl: WebGLRenderingContext) {
      if (DEBUG_TERRAIN_LAYER) console.log('[TerrainLayer] onAdd called')

      try {
        // MapLibre provides a complete MVP matrix; use a bare Camera and
        // drive its projection matrix directly (official Mapbox/MapLibre pattern).
        const camera = new THREE.Camera()
        camera.matrixAutoUpdate = false
        camera.matrixWorldAutoUpdate = false
        const scene = new THREE.Scene()

        // Create renderer using MapLibre's WebGL context
        const renderer = new THREE.WebGLRenderer({
          canvas: map.getCanvas(),
          context: gl as unknown as WebGL2RenderingContext,
          antialias: true
        })
        renderer.autoClear = false

        // Create terrain mesh (pass graph for vertex-to-node mapping)
        if (DEBUG_TERRAIN_LAYER) console.log('[TerrainLayer] Creating terrain mesh...')
        const terrainMesh = createTerrainMesh(config, graph)
        terrainMesh.frustumCulled = false

        // Mesh vertices are in METERS, centered at origin
        // Model matrix will: translate to Mercator position, scale from meters to Mercator

        const centerLng = (config.minLng + config.maxLng) / 2
        const centerLat = (config.minLat + config.maxLat) / 2
        const centerMerc = maplibregl.MercatorCoordinate.fromLngLat([centerLng, centerLat], 0)

        // Store model transform parameters (standard MapLibre custom layer approach)
        terrainMesh.userData.modelTransform = {
          translateX: centerMerc.x,
          translateY: centerMerc.y,
          translateZ: centerMerc.z || 0,
          scale: centerMerc.meterInMercatorCoordinateUnits()
        }
        terrainMesh.userData.centerMerc = centerMerc

        scene.add(terrainMesh)

        // Create wireframe grid overlay (hidden by default, contours provide depth cues)
        if (DEBUG_TERRAIN_LAYER) console.log('[TerrainLayer] Creating wireframe grid...')
        const wireframeGrid = createTerrainWireframe(terrainMesh, 0x000000, 0.3)
        wireframeGrid.frustumCulled = false
        wireframeGrid.visible = false  // Hide wireframe, use contours instead
        scene.add(wireframeGrid)

        // Create street network lines
        if (DEBUG_TERRAIN_LAYER) console.log('[TerrainLayer] Creating street network lines...')
        const streetNetworkLines = createStreetNetworkLines(
          terrainMesh,
          graph,
          0xffffff,  // white
          1.0,       // fully opaque
          3,         // z-offset
          2.5        // line width (reduced for better cross-DPR consistency, see ticket 002)
        )
        streetNetworkLines.renderOrder = 10  // Render on top of contours (renderOrder 5)
        scene.add(streetNetworkLines)

        if (DEBUG_TERRAIN_LAYER) {
          console.log('[TerrainLayer] Model transform:', terrainMesh.userData.modelTransform)
          console.log('[TerrainLayer] Center Mercator:', centerMerc.x, centerMerc.y)
        }

        // DEBUG: Add a simple test box to verify positioning
        if (DEBUG_TERRAIN_LAYER) {
          // Create a large test box (500m x 500m x 200m) to verify positioning
          const testBoxGeom = new THREE.BoxGeometry(500, 500, 200)
          const testBoxMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide })
          const testBox = new THREE.Mesh(testBoxGeom, testBoxMat)
          testBox.position.set(0, 0, 100)  // 100m up so bottom is at 0
          testBox.frustumCulled = false
          scene.add(testBox)
          console.log('[TerrainLayer] DEBUG: Added test box (500x500x200m) at center, pos:', testBox.position)
        }

        // Add lighting (for when we switch to MeshStandardMaterial)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
        scene.add(ambientLight)

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6)
        directionalLight.position.set(0, -70, 100).normalize()
        scene.add(directionalLight)

        // Create empty group for attractor pins (will be populated when attractors are added)
        const attractorPinsGroup = new THREE.Group()
        scene.add(attractorPinsGroup)

        // Contour lines will be created when terrain is updated (needs height data)
        // Initial terrain is flat, so no contours needed yet
        const contourLines: THREE.Mesh | null = null

        // Store state - start visible by default (will be controlled by MapView)
        layerState = {
          scene,
          camera,
          renderer,
          terrainMesh,
          wireframeGrid,
          streetNetworkLines,
          contourLines,
          attractorPinsGroup,
          attractorPinData: new Map(),
          graph,
          config,
          map,
          lastCanvasWidth: 0,
          lastCanvasHeight: 0,
          visible: true
        }

        if (DEBUG_TERRAIN_LAYER) console.log('[TerrainLayer] Layer initialized successfully')
      } catch (error) {
        console.error('[TerrainLayer] Error in onAdd:', error)
      }
    },

    render(_gl: WebGLRenderingContext, args: maplibregl.CustomRenderMethodInput) {
      if (!layerState || !layerState.terrainMesh || !layerState.config) {
        return
      }

      // Skip rendering if not visible
      if (!layerState.visible) {
        return
      }

      // Log once with debug info
      if (DEBUG_TERRAIN_LAYER && !(this as any)._logged) {
        console.log('[TerrainLayer] render() called')
        const modelTransform = layerState.terrainMesh.userData.modelTransform
        console.log('[TerrainLayer] Model transform:', modelTransform)

        const positions = (layerState.terrainMesh.geometry as THREE.BufferGeometry).attributes.position.array
        console.log('[TerrainLayer] First vertex (model meters):', positions[0], positions[1], positions[2])
        ;(this as any)._logged = true
      }

      try {
        const { scene, camera, renderer, terrainMesh, map } = layerState

        // Keep renderer size in sync with MapLibre's canvas (important for DPR/resizes)
        const canvas = map?.getCanvas()
        if (canvas) {
          const w = canvas.width
          const h = canvas.height
          if (w !== layerState.lastCanvasWidth || h !== layerState.lastCanvasHeight) {
            renderer.setSize(w, h, false)
            layerState.lastCanvasWidth = w
            layerState.lastCanvasHeight = h
          }
        }

        // MapLibre shares GL state; reset before Three renders.
        renderer.resetState()

        // MapLibre 5.x uses defaultProjectionData.mainMatrix instead of modelViewProjectionMatrix
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const argsAny = args as any
        const matrixArray = argsAny.defaultProjectionData?.mainMatrix || args.modelViewProjectionMatrix

        if (DEBUG_TERRAIN_LAYER && !(this as any)._argsLogged) {
          console.log('[TerrainLayer] args keys:', Object.keys(args))
          console.log('[TerrainLayer] Using matrix from:', argsAny.defaultProjectionData?.mainMatrix ? 'defaultProjectionData.mainMatrix' : 'modelViewProjectionMatrix')
          ;(this as any)._argsLogged = true
        }

        const m = new THREE.Matrix4().fromArray(matrixArray)

        const modelTransform = terrainMesh.userData.modelTransform as {
          translateX: number
          translateY: number
          translateZ: number
          scale: number
        }

        // Try using getMatrixForModel if available (recommended MapLibre 5.x API)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapTransform = (map as any)?.transform
        let l: THREE.Matrix4

        if (mapTransform?.getMatrixForModel) {
          // Use the official API for getting model matrix
          const centerLng = (layerState.config!.minLng + layerState.config!.maxLng) / 2
          const centerLat = (layerState.config!.minLat + layerState.config!.maxLat) / 2
          const modelMatrix = mapTransform.getMatrixForModel([centerLng, centerLat], 0)
          l = new THREE.Matrix4().fromArray(modelMatrix)

          // Apply rotation to orient the plane horizontally
          // PlaneGeometry is in XY plane, we need it in XZ plane (horizontal)
          // Rotate -90 degrees around X axis
          const rotationX = new THREE.Matrix4().makeRotationX(-Math.PI / 2)
          l.multiply(rotationX)

          if (DEBUG_TERRAIN_LAYER && !(this as any)._matrixLogged) {
            console.log('[TerrainLayer] Using getMatrixForModel API')
            console.log('[TerrainLayer] Model matrix from API (first 4):', modelMatrix.slice(0, 4))
            ;(this as any)._matrixLogged = true
          }
        } else {
          // Fallback: manual transform
          l = new THREE.Matrix4()
            .makeTranslation(modelTransform.translateX, modelTransform.translateY, modelTransform.translateZ)
            .scale(new THREE.Vector3(modelTransform.scale, -modelTransform.scale, modelTransform.scale))

          if (DEBUG_TERRAIN_LAYER && !(this as any)._matrixLogged) {
            console.log('[TerrainLayer] Using manual transform (getMatrixForModel not available)')
            ;(this as any)._matrixLogged = true
          }
        }

        camera.projectionMatrix.copy(m.multiply(l))
        // Some Three internals (culling, helpers) use this inverse.
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()
        camera.matrixWorld.identity()
        camera.matrixWorldInverse.identity()

        terrainMesh.visible = true

        // Force re-upload of attributes each frame (needed for shared WebGL context)
        const geometry = terrainMesh.geometry as THREE.BufferGeometry
        if (geometry.attributes.color) {
          geometry.attributes.color.needsUpdate = true
        }
        if (geometry.attributes.position) {
          geometry.attributes.position.needsUpdate = true
        }

        // Also update wireframe geometry attributes (SDF instanced geometry)
        if (layerState.wireframeGrid) {
          const wireframeGeometry = layerState.wireframeGrid.geometry as THREE.InstancedBufferGeometry
          if (wireframeGeometry.attributes.instanceStart) {
            wireframeGeometry.attributes.instanceStart.needsUpdate = true
          }
          if (wireframeGeometry.attributes.instanceEnd) {
            wireframeGeometry.attributes.instanceEnd.needsUpdate = true
          }
        }

        // Update SDF material resolution for all line meshes (required for screen-space calculations)
        if (canvas) {
          if (layerState.streetNetworkLines) {
            const material = layerState.streetNetworkLines.material as SDFLineMaterial
            material.resolution.set(canvas.width, canvas.height)
          }
          if (layerState.wireframeGrid) {
            const material = layerState.wireframeGrid.material as SDFLineMaterial
            material.resolution.set(canvas.width, canvas.height)
          }
          if (layerState.contourLines) {
            // Contour lines is a Group - update resolution for all child meshes
            for (const child of layerState.contourLines.children) {
              const material = (child as THREE.Mesh).material as SDFLineMaterial
              material.resolution.set(canvas.width, canvas.height)
            }
          }
          // Update resolution for attractor pin connecting lines
          if (layerState.attractorPinData) {
            for (const data of layerState.attractorPinData.values()) {
              const material = data.line.material as SDFLineMaterial
              material.resolution.set(canvas.width, canvas.height)
            }
          }
        }

        renderer.render(scene, camera)

        // Compute and cache screen positions for attractor pins during render
        // (when the camera projection matrix is valid)
        if (layerState.attractorPinData && layerState.attractorPinData.size > 0 && canvas) {
          cachedScreenPositions.clear()

          // Get device pixel ratio to convert from canvas pixels to CSS pixels
          // MapLibre's map.project() returns CSS pixels, so we need to match that
          const dpr = window.devicePixelRatio || 1
          const cssWidth = canvas.width / dpr
          const cssHeight = canvas.height / dpr

          for (const [id, data] of layerState.attractorPinData) {
            // Sample terrain height and compute total height
            const terrainHeight = sampleTerrainHeight(data.coord, terrainMesh)
            const totalHeight = terrainHeight + PIN_HEIGHT_OFFSET

            // Convert to local meters
            const localPos = lngLatToLocalMeters(data.coord, layerState.config!)

            // Create 3D point and project using current camera matrix
            const point = new THREE.Vector3(localPos.x, localPos.y, totalHeight)
            const projected = point.clone().applyMatrix4(camera.projectionMatrix)

            // Check visibility
            const visible = projected.x >= -1 && projected.x <= 1 &&
                           projected.y >= -1 && projected.y <= 1 &&
                           projected.z >= -1 && projected.z <= 1

            // Convert NDC to CSS pixels (matching MapLibre's coordinate system)
            const x = (projected.x + 1) * 0.5 * cssWidth
            const y = (1 - projected.y) * 0.5 * cssHeight

            cachedScreenPositions.set(id, { x, y, visible })
          }
        }

        // Log MVP matrix once
        if (DEBUG_TERRAIN_LAYER && !(this as any)._renderLogged) {
          const mvp = Array.from(args.modelViewProjectionMatrix)
          console.log('[TerrainLayer] Raw MVP col0:', mvp.slice(0, 4))
          console.log('[TerrainLayer] Raw MVP col3:', mvp.slice(12, 16))
          ;(this as any)._renderLogged = true
        }
      } catch (error) {
        console.error('[TerrainLayer] Render error:', error)
      }
    },

    onRemove() {
      if (DEBUG_TERRAIN_LAYER) console.log('[TerrainLayer] onRemove called')
      if (layerState) {
        if (layerState.terrainMesh) {
          layerState.terrainMesh.geometry.dispose()
          if (layerState.terrainMesh.material instanceof THREE.Material) {
            layerState.terrainMesh.material.dispose()
          }
        }
        if (layerState.wireframeGrid) {
          layerState.wireframeGrid.geometry.dispose()
          if (layerState.wireframeGrid.material instanceof THREE.Material) {
            layerState.wireframeGrid.material.dispose()
          }
        }
        if (layerState.streetNetworkLines) {
          layerState.streetNetworkLines.geometry.dispose()
          if (layerState.streetNetworkLines.material instanceof THREE.Material) {
            layerState.streetNetworkLines.material.dispose()
          }
        }
        if (layerState.contourLines) {
          // Contour lines is a Group - dispose all child meshes
          for (const child of layerState.contourLines.children) {
            const mesh = child as THREE.Mesh
            mesh.geometry.dispose()
            ;(mesh.material as THREE.Material).dispose()
          }
        }
        // Clean up attractor pins
        if (layerState.attractorPinData) {
          for (const data of layerState.attractorPinData.values()) {
            // Sprite may be null if we're using HTML pins instead
            if (data.sprite) {
              data.sprite.geometry?.dispose()
              if (data.sprite.material instanceof THREE.Material) {
                data.sprite.material.dispose()
              }
            }
            data.line.geometry.dispose()
            ;(data.line.material as THREE.Material).dispose()
          }
          layerState.attractorPinData.clear()
        }
        layerState = null
        // Clear cached screen positions
        cachedScreenPositions.clear()
      }
    }
  }
}

/**
 * Update the terrain mesh with new attractors and decay function
 * Returns statistics for the Legend component
 *
 * @param attractors - Array of grid attractors (amenities)
 * @param decayFn - Distance decay function
 * @param distanceMatrix - Full network distance matrix (all nodes to all nodes)
 * @param smoothingSigma - Optional Gaussian blur sigma for terrain smoothing
 * @param heightScale - Optional maximum terrain height in meters
 * @param fixedRange - Optional fixed range for color normalization
 */
export function updateTerrainLayer(
  attractors: GridAttractor[],
  decayFn: (distance: number) => number,
  distanceMatrix: DistanceMatrix,
  smoothingSigma?: number,
  heightScale?: number,
  fixedRange?: { min: number; max: number }
): { min: number; max: number; avg: number } | null {
  if (!layerState || !layerState.terrainMesh) {
    console.warn('[TerrainLayer] Not initialized, cannot update')
    return null
  }

  if (DEBUG_TERRAIN_LAYER) console.log('[TerrainLayer] Updating terrain from attractors...')

  const stats = updateTerrainFromAttractors(
    layerState.terrainMesh,
    attractors,
    decayFn,
    distanceMatrix,
    smoothingSigma,
    heightScale,
    fixedRange
  )

  // Update wireframe positions to match terrain
  if (layerState.wireframeGrid) {
    updateWireframePositions(layerState.wireframeGrid, layerState.terrainMesh)
  }

  // Update street network heights to match terrain
  if (layerState.streetNetworkLines && layerState.graph) {
    updateStreetNetworkHeights(layerState.streetNetworkLines, layerState.terrainMesh, layerState.graph)
  }

  // Update attractor pin heights to match terrain
  if (layerState.attractorPinsGroup && layerState.attractorPinData.size > 0) {
    updateAttractorPinHeights(layerState.attractorPinData, layerState.terrainMesh)
  }

  // Update or create contour lines
  if (layerState.contourLines) {
    // Update existing contour lines
    updateContourLines(layerState.contourLines, layerState.terrainMesh)
  } else {
    // Create contour lines for the first time
    const contourGroup = createContourLines(layerState.terrainMesh)
    if (contourGroup) {
      layerState.scene.add(contourGroup)
      layerState.contourLines = contourGroup
    }
  }

  // Trigger map repaint
  if (layerState.map) {
    layerState.map.triggerRepaint()
  }

  return stats
}

/**
 * Update attractor pins (add/remove/update based on current attractors)
 * Call this when attractors change (add, remove, drag, attractivity edit)
 */
export function updateAttractorPins(attractors: GridAttractor[]): void {
  if (!layerState || !layerState.terrainMesh || !layerState.attractorPinsGroup) {
    return
  }

  // Sync pins with current attractor state
  layerState.attractorPinData = syncAttractorPins(
    layerState.attractorPinsGroup,
    layerState.attractorPinData,
    attractors,
    layerState.terrainMesh
  )

  // Trigger map repaint
  if (layerState.map) {
    layerState.map.triggerRepaint()
  }
}

/**
 * Reset the terrain to flat ground
 */
export function resetTerrainLayer(): void {
  if (!layerState || !layerState.terrainMesh) return
  resetTerrainMesh(layerState.terrainMesh)
}

/**
 * Set the visibility of the terrain layer
 */
export function setTerrainLayerVisibility(visible: boolean): void {
  if (!layerState) return
  layerState.visible = visible

  // Trigger repaint to update visibility
  if (layerState.map) {
    layerState.map.triggerRepaint()
  }
}

/**
 * Set the opacity of the terrain mesh material
 */
export function setTerrainMeshOpacity(opacity: number): void {
  if (!layerState || !layerState.terrainMesh) return

  const material = layerState.terrainMesh.material as THREE.MeshBasicMaterial
  material.transparent = opacity < 1
  material.opacity = opacity
  material.needsUpdate = true

  // Trigger repaint
  if (layerState.map) {
    layerState.map.triggerRepaint()
  }
}

/**
 * Set the visibility of the 3D street network on terrain
 */
export function setTerrainStreetNetworkVisibility(visible: boolean): void {
  if (!layerState || !layerState.streetNetworkLines) return
  layerState.streetNetworkLines.visible = visible

  // Trigger repaint
  if (layerState.map) {
    layerState.map.triggerRepaint()
  }
}

/**
 * Check if the terrain layer is initialized
 */
export function isTerrainLayerInitialized(): boolean {
  return layerState !== null && layerState.terrainMesh !== null
}

/**
 * Get the terrain layer ID
 */
export function getTerrainLayerId(): string {
  return 'terrain-3d-threejs'
}

/**
 * Set the visibility of the wireframe grid overlay
 */
export function setWireframeVisibility(visible: boolean): void {
  if (!layerState || !layerState.wireframeGrid) return
  layerState.wireframeGrid.visible = visible

  // Trigger repaint to update visibility
  if (layerState.map) {
    layerState.map.triggerRepaint()
  }
}

/**
 * Set the visibility of the street network lines
 */
export function setStreetNetworkVisibility(visible: boolean): void {
  if (!layerState || !layerState.streetNetworkLines) return
  layerState.streetNetworkLines.visible = visible

  // Trigger repaint to update visibility
  if (layerState.map) {
    layerState.map.triggerRepaint()
  }
}

/**
 * Set the visibility of the contour lines
 */
export function setContourVisibility(visible: boolean): void {
  if (!layerState || !layerState.contourLines) return
  layerState.contourLines.visible = visible

  // Trigger repaint to update visibility
  if (layerState.map) {
    layerState.map.triggerRepaint()
  }
}

/**
 * Project a 3D point (lng/lat + altitude above terrain) to screen coordinates.
 *
 * This function accounts for terrain height, unlike MapLibre's map.project() which
 * only does 2D projection. Use this for positioning HTML elements that should
 * appear at terrain-relative positions.
 *
 * @param lngLat - Longitude/latitude coordinates
 * @param altitude - Height above terrain in meters (default: 0)
 * @returns Screen coordinates {x, y, visible} or null if layer not initialized
 */
export function projectToScreen(
  lngLat: [number, number],
  altitude: number = 0
): { x: number; y: number; visible: boolean } | null {
  if (!layerState || !layerState.terrainMesh || !layerState.camera || !layerState.map || !layerState.config) {
    return null
  }

  const config = layerState.config
  const canvas = layerState.map.getCanvas()

  // 1. Sample terrain height at the given lng/lat
  const terrainHeight = sampleTerrainHeight(lngLat, layerState.terrainMesh)
  const totalHeight = terrainHeight + altitude

  // 2. Convert lng/lat to local meters (same coord system as terrain mesh)
  const localPos = lngLatToLocalMeters(lngLat, config)

  // 3. Create 3D vector in terrain's local coordinate system
  // Note: In our model space, Y is north-positive and Z is up.
  // But the projection matrix includes a -90° X rotation, which maps:
  //   model Y -> screen Z (depth)
  //   model Z -> screen Y (up on screen after negation)
  // So we need: point.y = localPos.y (north), point.z = height
  const point = new THREE.Vector3(localPos.x, localPos.y, totalHeight)

  // 4. Apply the camera's projection matrix (which includes model transform)
  // This gives us Normalized Device Coordinates (NDC) in range [-1, 1]
  const projected = point.clone().applyMatrix4(layerState.camera.projectionMatrix)

  // 5. Check if point is visible (in front of camera and within frustum)
  // In NDC, points outside [-1, 1] range for x, y, z are clipped
  const visible = projected.x >= -1 && projected.x <= 1 &&
                  projected.y >= -1 && projected.y <= 1 &&
                  projected.z >= -1 && projected.z <= 1

  // 6. Convert NDC to screen pixels
  // NDC x: -1 (left) to +1 (right) -> 0 to canvas.width
  // NDC y: -1 (bottom) to +1 (top) -> canvas.height to 0 (screen Y is inverted)
  const x = (projected.x + 1) * 0.5 * canvas.width
  const y = (1 - projected.y) * 0.5 * canvas.height

  return { x, y, visible }
}

/**
 * Get screen positions for all attractor pins.
 *
 * Returns a Map of attractor ID to screen position {x, y, visible}.
 * Use this to position HTML marker elements that should appear above terrain pins.
 *
 * Note: These positions are computed during the Three.js render cycle when the
 * camera projection matrix is valid, and cached for use by the HTML positioning code.
 */
export function getAttractorPinScreenPositions(): Map<string, { x: number; y: number; visible: boolean }> {
  // Return a copy to prevent external mutation
  return new Map(cachedScreenPositions)
}

/**
 * Get the terrain layer state for external access (e.g., for render event subscription)
 */
export function getTerrainLayerMap(): maplibregl.Map | null {
  return layerState?.map ?? null
}
