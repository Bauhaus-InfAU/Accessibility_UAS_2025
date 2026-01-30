import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import maplibregl from 'maplibre-gl'
import type { StreetGraph, GridAttractor } from '../config/types'
import {
  createTerrainMesh,
  updateTerrainFromAttractors,
  resetTerrainMesh,
  getGraphBounds,
  createTerrainWireframe,
  updateWireframePositions,
  createStreetNetworkLines,
  updateStreetNetworkHeights,
  type TerrainMeshConfig
} from './terrainMesh'

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
  wireframeGrid: THREE.LineSegments | null
  streetNetworkLines: LineSegments2 | null
  graph: StreetGraph | null
  config: TerrainMeshConfig | null
  map: maplibregl.Map | null
  lastCanvasWidth: number
  lastCanvasHeight: number
  visible: boolean
}

// Global state for the layer
let layerState: ThreeJsTerrainLayerState | null = null

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

        // Create terrain mesh
        if (DEBUG_TERRAIN_LAYER) console.log('[TerrainLayer] Creating terrain mesh...')
        const terrainMesh = createTerrainMesh(config)
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

        // Create wireframe grid overlay
        if (DEBUG_TERRAIN_LAYER) console.log('[TerrainLayer] Creating wireframe grid...')
        const wireframeGrid = createTerrainWireframe(terrainMesh, 0x000000, 0.3)
        wireframeGrid.frustumCulled = false
        scene.add(wireframeGrid)

        // Create street network lines
        if (DEBUG_TERRAIN_LAYER) console.log('[TerrainLayer] Creating street network lines...')
        const streetNetworkLines = createStreetNetworkLines(terrainMesh, graph)
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

        // Store state - start visible by default (will be controlled by MapView)
        layerState = {
          scene,
          camera,
          renderer,
          terrainMesh,
          wireframeGrid,
          streetNetworkLines,
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

        // Also update wireframe geometry attributes
        if (layerState.wireframeGrid) {
          const wireframeGeometry = layerState.wireframeGrid.geometry as THREE.BufferGeometry
          if (wireframeGeometry.attributes.position) {
            wireframeGeometry.attributes.position.needsUpdate = true
          }
        }

        // Update street network LineMaterial resolution (required for Line2)
        if (layerState.streetNetworkLines) {
          const material = layerState.streetNetworkLines.material as LineMaterial
          if (canvas) {
            material.resolution.set(canvas.width, canvas.height)
          }
        }

        renderer.render(scene, camera)

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
        layerState = null
      }
    }
  }
}

/**
 * Update the terrain mesh with new attractors and decay function
 * Returns statistics for the Legend component
 */
export function updateTerrainLayer(
  attractors: GridAttractor[],
  decayFn: (distance: number) => number
): { min: number; max: number; avg: number } | null {
  if (!layerState || !layerState.terrainMesh) {
    console.warn('[TerrainLayer] Not initialized, cannot update')
    return null
  }

  if (DEBUG_TERRAIN_LAYER) console.log('[TerrainLayer] Updating terrain from attractors...')

  const stats = updateTerrainFromAttractors(
    layerState.terrainMesh,
    attractors,
    decayFn
  )

  // Update wireframe positions to match terrain
  if (layerState.wireframeGrid) {
    updateWireframePositions(layerState.wireframeGrid, layerState.terrainMesh)
  }

  // Update street network heights to match terrain
  if (layerState.streetNetworkLines && layerState.graph) {
    updateStreetNetworkHeights(layerState.streetNetworkLines, layerState.terrainMesh, layerState.graph)
  }

  // Trigger map repaint
  if (layerState.map) {
    layerState.map.triggerRepaint()
  }

  return stats
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
