# Three.js and MapLibre Integration Architecture

This document explains how Three.js and MapLibre GL JS work together in the terrain visualization system.

## Overview

The terrain visualization uses Three.js rendered as a MapLibre **custom layer**. Both libraries share the same WebGL context but render **sequentially**, not as a unified 3D scene.

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Canvas                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────┐      ┌─────────────────┐              │
│   │   MapLibre GL   │      │    Three.js     │              │
│   │                 │      │                 │              │
│   │  • Map tiles    │      │  • Terrain mesh │              │
│   │  • Buildings    │      │  • Wireframe    │              │
│   │  • Streets      │ ───► │  • Street lines │              │
│   │  • Markers      │      │                 │              │
│   │                 │      │                 │              │
│   └────────┬────────┘      └────────┬────────┘              │
│            │                        │                        │
│            └───────────┬────────────┘                        │
│                        │                                     │
│                        ▼                                     │
│            ┌─────────────────────┐                          │
│            │  Shared WebGL       │                          │
│            │  Context            │                          │
│            └─────────────────────┘                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## What They Share

### 1. WebGL Rendering Context

MapLibre creates the WebGL context when initializing the map. Three.js reuses this same context:

```typescript
// In threeJsLayer.ts - onAdd()
const renderer = new THREE.WebGLRenderer({
  canvas: map.getCanvas(),           // MapLibre's canvas
  context: gl as WebGL2RenderingContext,  // MapLibre's WebGL context
  antialias: true
})
renderer.autoClear = false  // Don't clear - MapLibre already rendered
```

### 2. Canvas Element

Both render to the same HTML canvas element. MapLibre owns the canvas; Three.js draws on top of it.

### 3. Projection Matrix

MapLibre provides the view-projection matrix each frame via the custom layer's `render()` callback:

```typescript
render(gl: WebGLRenderingContext, args: CustomRenderMethodInput) {
  // MapLibre provides the projection matrix
  const matrixArray = args.defaultProjectionData?.mainMatrix
                   || args.modelViewProjectionMatrix

  // Three.js uses it for its camera
  camera.projectionMatrix.copy(new THREE.Matrix4().fromArray(matrixArray))
}
```

## What They Do NOT Share

### 1. Scene Graph

- **MapLibre**: Has its own internal scene representation (layers, sources, features)
- **Three.js**: Has its own `THREE.Scene` with meshes, lights, etc.

They are completely separate. You cannot add a Three.js mesh to MapLibre's scene or vice versa.

### 2. Depth Buffer Integration

The depth buffers are **not integrated**. This means:

- Three.js objects cannot be occluded by MapLibre buildings
- MapLibre features cannot be occluded by Three.js geometry
- We use `depthTest: false` on street lines to ensure they render on top

```typescript
// Street lines always render on top of terrain
const material = new LineMaterial({
  depthTest: false,   // Ignore depth buffer
  depthWrite: false   // Don't write to depth buffer
})
```

### 3. Anti-Aliasing / Line Rendering Technique

This is the most important difference to understand:

**MapLibre** does NOT use WebGL's built-in line primitives or MSAA for smooth lines. Instead, it uses **SDF (Signed Distance Field) rendering**:

```
MapLibre Line Rendering Pipeline:
1. Line segment → converted to screen-aligned QUAD (2 triangles)
2. Fragment shader calculates signed distance from pixel to ideal line center
3. Pixels near edge get smooth alpha falloff via smoothstep()
4. Result: perfectly anti-aliased lines at any width or zoom
```

```glsl
// Simplified SDF line shader concept (what MapLibre does internally)
float distance = abs(pixelDistanceFromLineCenter);
float alpha = smoothstep(halfWidth + softness, halfWidth - softness, distance);
gl_FragColor = vec4(lineColor, alpha);  // Smooth edges!
```

**Three.js** line rendering options:

| Three.js Approach | Technique | Anti-aliasing Quality |
|-------------------|-----------|----------------------|
| `LineBasicMaterial` | WebGL `gl.LINES` primitive | None - hard 1px lines, jagged |
| `LineMaterial` (Line2) | Screen-aligned quads | Partial - better but not SDF |
| Custom SDF shader | Same as MapLibre | Smooth - requires custom code |

**Why WebGL MSAA doesn't help:**
- MSAA (Multisample Anti-Aliasing) only works on triangle/polygon edges
- WebGL line primitives are rasterized separately, MSAA has minimal effect
- Line width is often limited to 1px by GPU drivers

**Bottom line:** MapLibre's smooth lines come from sophisticated shader math, not from WebGL's built-in anti-aliasing. Three.js would need custom shaders to achieve the same quality.

### 4. Coordinate Systems (Initially)

- **MapLibre**: Uses Web Mercator coordinates (0-1 range globally)
- **Three.js**: Uses local meters centered at origin

We must transform Three.js geometry to match MapLibre's coordinate system.

## Rendering Pipeline

### Frame Sequence

Each frame, rendering happens in this order:

```
1. MapLibre clears canvas and renders:
   ├── Background layer
   ├── Raster tiles (if any)
   ├── Vector tiles (streets, etc.)
   ├── Custom layers (including our Three.js layer) ◄── Three.js renders here
   ├── Building extrusions
   └── Markers/popups

2. Three.js custom layer render() is called:
   ├── Reset WebGL state (required!)
   ├── Update camera with MapLibre's projection matrix
   ├── Apply model transform (meters → Mercator)
   └── Render scene (terrain, wireframe, streets)
```

### WebGL State Reset

Because they share the WebGL context, Three.js must reset state before rendering:

```typescript
render(gl, args) {
  // MapLibre may have left WebGL in any state
  // Three.js needs a clean slate
  renderer.resetState()

  // Now safe to render
  renderer.render(scene, camera)
}
```

### Attribute Re-upload

Due to shared context, geometry attributes must be marked for re-upload each frame:

```typescript
// Force re-upload of vertex data each frame
geometry.attributes.position.needsUpdate = true
geometry.attributes.color.needsUpdate = true
```

## Coordinate Transformation

### The Problem

- Three.js geometry is in **local meters** (e.g., terrain is ~2000m × 1500m)
- MapLibre expects **Mercator coordinates** (tiny fractions like 0.00001)

### The Solution

We use MapLibre's `getMatrixForModel()` API to get a transformation matrix:

```typescript
// Get model matrix from MapLibre
const modelMatrix = map.transform.getMatrixForModel([centerLng, centerLat], altitude)

// This matrix:
// 1. Translates from origin to the center point in Mercator space
// 2. Scales from meters to Mercator units
// 3. Handles the projection correctly
```

### Coordinate Flow

```
Three.js Geometry          Model Transform           MapLibre Space
(local meters)        →    (via matrix)         →   (Mercator coords)

Vertex at (500, 300, 50)   Apply model matrix       Appears at correct
in meters from center   →  from getMatrixForModel → lng/lat position
                                                    on the map
```

## Custom Layer Interface

MapLibre's custom layer API provides three hooks:

```typescript
interface CustomLayerInterface {
  id: string
  type: 'custom'
  renderingMode: '3d'

  // Called once when layer is added to map
  onAdd(map: Map, gl: WebGLRenderingContext): void

  // Called every frame - this is where Three.js renders
  render(gl: WebGLRenderingContext, args: CustomRenderMethodInput): void

  // Called when layer is removed
  onRemove(): void
}
```

## Limitations

| Limitation | Description | Workaround |
|------------|-------------|------------|
| No depth integration | Three.js and MapLibre can't occlude each other | Use `depthTest: false` for overlay elements |
| Line aliasing | Three.js lines are jagged compared to MapLibre | Use LineSegments2 with LineMaterial, increase width |
| No unified picking | Can't ray-cast through both systems | Handle interaction separately |
| State conflicts | WebGL state can be corrupted | Call `renderer.resetState()` each frame |
| Memory overhead | Both maintain separate buffers | Minimize geometry complexity |

## File Structure

```
src/visualization/
├── threeJsLayer.ts      # MapLibre custom layer, scene management
├── terrainMesh.ts       # Terrain geometry, wireframe, street lines
└── mapLibreSetup.ts     # MapLibre initialization, native layers
```

## Key Functions

### `createThreeJsTerrainLayer(graph)`
Creates the MapLibre custom layer interface. Sets up Three.js scene, camera, renderer.

### `updateTerrainLayer(attractors, decayFn)`
Updates terrain heights and colors. Also updates wireframe and street line positions.

### `setTerrainLayerVisibility(visible)`
Shows/hides the entire Three.js layer (terrain + wireframe + streets).

### `setStreetLayersVisibility(map, visible)`
Shows/hides MapLibre's native street layers (separate from Three.js streets).

## Visual Comparison

| Aspect | MapLibre | Three.js |
|--------|----------|----------|
| Line rendering | SDF-based, smooth | Basic WebGL, can be jagged |
| Anti-aliasing | Built-in, high quality | Limited by WebGL |
| 3D terrain | Not native (requires terrain tiles) | Full control over geometry |
| Performance | Highly optimized for maps | General-purpose 3D |
| Interaction | Built-in hover/click | Manual implementation |

## References

- [MapLibre Custom Layers](https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/)
- [Three.js WebGLRenderer](https://threejs.org/docs/#api/en/renderers/WebGLRenderer)
- [Three.js Line2/LineMaterial](https://threejs.org/docs/#examples/en/lines/Line2)
