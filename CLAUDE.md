# DistanceDecayBuilder - Project Context

## Project Overview
- **Name**: DistanceDecayBuilder
- **Purpose**: Educational web app for interactive spatial accessibility analysis
- **Domain**: Urban planning / spatial accessibility / distance decay
- **Audience**: University students in a spatial accessibility course
- **Hosting**: GitHub Pages (no backend)
- **Reference**: Adapted from [Bauhaus-InfAU/weimar-web](https://github.com/Bauhaus-InfAU/weimar-web) (data only)

## Core Concept

Students define a custom distance decay function f(d) graphically, then see how it affects accessibility scores on a 3D city model.

**Formula**: `Acc_i = Σ(j) Att_j * f(d_ij)`
- Acc_i = accessibility of residential building i
- Att_j = attractivity of amenity j (floor area, volume, or 1)
- f(d_ij) = user-defined decay function (0 to 1) at distance d_ij
- d_ij = shortest path distance via street network

## Tech Stack
- TypeScript + React + Vite
- MapLibre GL JS (3D building rendering + custom markers)
- Three.js (terrain mesh visualization via MapLibre custom layer)
- Tailwind CSS (styling)
- SVG (interactive curve editor)
- Web Worker (Dijkstra precomputation)

## Key Features
- **Analysis Modes**: Toggle between Buildings and Grid modes
  - Buildings mode: Accessibility for residential buildings based on amenities
  - Grid mode: Accessibility on hexagonal grid based on user-placed custom amenities
- **Distance Decay Curve**: Tabbed editor with three modes:
  - Custom: Polyline editor with draggable points and presets
  - Negative Exponential: f(d_ij) = e^(-α·d_ij) with α coefficient input
  - Exponential Power: f(d_ij) = e^{-(d_ij/b)^c} with b and c coefficient inputs
- **Amenity Selection**: 14 predefined land use types from Weimar data
- **Custom Pins**: User-placed amenity markers on the map (2 default pins on startup, click to add, drag to move, right-click to delete)
  - Each pin has editable attractivity value (default 1, click box to edit)
  - Pin size scales proportionally with attractivity (sqrt scale: 1→1.0x, 5→1.5x, 10→1.86x, max 2.0x)
- **Custom Amenities (Grid mode)**: User-placed amenity points (2 default on startup, same interactions as custom pins)
  - Each amenity has editable attractivity value with visual attractivity box
  - Amenity size scales proportionally with attractivity (same as custom pins)
- **Attractivity Modes**: Floor area, volume, or count-based weighting (Buildings mode with predefined amenities)
- **3D Visualization**: Buildings colored by accessibility score (purple=low, red=high)
- **Hexagon Grid**: ~15m diameter hexagons colored by accessibility (Grid mode), organic boundary within 100m of network
- **Hover Popups**: Show raw accessibility score on hover (buildings or hexagons)
- **Distance Measurement Tool**: Compare network vs euclidean distances between two points
  - Ruler toggle button below navigation widget
  - Shows network path (solid) and euclidean path (dashed) simultaneously
  - Distance labels at path midpoints, hover to bring to front
  - Escape key to exit measurement mode

## Project Structure
```
src/
├── config/          # Types (LandUse, CustomPin, Building, CurveTabMode, AnalysisMode, HexCell, GridAttractor with attractivity) + constants
├── data/            # GeoJSON loading, building/street processing, graph building, hexagon grid
│   ├── dataLoader.ts      # GeoJSON file loading
│   ├── buildingStore.ts   # Building processing and land use queries
│   ├── streetGraph.ts     # Street network graph construction
│   └── hexagonGrid.ts     # Hexagon grid generation and street intersection detection
├── computation/     # Dijkstra worker, distance matrix, accessibility calc, curve eval
│   ├── dijkstra.worker.ts      # Web Worker for shortest path computation
│   ├── dijkstraAlgorithm.ts    # Dijkstra implementation (includes dijkstraWithPath for measurement)
│   ├── measurementCalc.ts      # Measurement utilities (findShortestPath, path midpoint calculations)
│   ├── distanceMatrix.ts       # Distance matrix computation (buildings + full network)
│   ├── accessibilityCalc.ts    # Buildings mode accessibility calculation
│   ├── gridAccessibilityCalc.ts # Grid mode accessibility calculation
│   ├── terrainAccessibilityCalc.ts # Terrain mode Euclidean distance calculation
│   └── curveEvaluator.ts       # Distance decay function evaluation
├── components/      # React UI (App, CurveEditor, panels, map)
│   ├── CurveEditor/ # Tabbed curve editor with multiple modes
│   │   ├── CurveEditor.tsx      # Main component with tabs
│   │   ├── CurveCanvas.tsx      # SVG grid/axes (shared), mouse tracking
│   │   ├── CurveExplorer.tsx    # Crosshair overlay with value labels
│   │   ├── PolylineEditor.tsx   # Custom mode - draggable points
│   │   ├── MathCurveDisplay.tsx # Mathematical function curve renderer
│   │   └── CoefficientInputs.tsx # Parameter inputs for math functions
│   ├── panels/      # ParametersPanel, NavigationWidget, Legend, AppInfo, MeasurementWidget, dropdowns, AnalysisModeToggle
│   └── map/         # MapView (includes custom pin/attractor marker management)
├── visualization/   # MapLibre setup + color updates + Three.js terrain
│   ├── mapLibreSetup.ts         # Map initialization, layers (buildings, hexagons, streets)
│   ├── buildingColorUpdater.ts  # Building color updates based on scores
│   ├── hexagonColorUpdater.ts   # Hexagon color updates and layer visibility
│   ├── terrainMesh.ts           # Terrain mesh creation, updates, wireframe, street network
│   ├── threeJsLayer.ts          # MapLibre custom layer for Three.js terrain rendering
│   ├── SDFLineMaterial.ts       # Custom material for smooth anti-aliased lines
│   └── shaders/
│       └── sdfLine.ts           # GLSL vertex/fragment shaders for SDF lines
├── context/         # React Context (AppContext stores scores + avg/min/max + curve state + grid state, MapContext)
└── lib/             # Utilities
```

## Responsive Design

The app adapts to different screen sizes using Tailwind CSS breakpoints.

### Breakpoints
| Breakpoint | Width | Description |
|------------|-------|-------------|
| Mobile | < 640px | Full-width panels, stacked layouts |
| Desktop | ≥ 640px (sm:) | Floating panels, side-by-side layouts |

### Desktop Layout (≥ 640px)
```
┌─────────────────────────────────────────────────────────────────┐
│ [Parameters Panel]                        [Navigation Widget]   │
│  (540px, rounded, top-left)               (top-right)           │
│                                                                 │
│                         [MAP]                                   │
│                                                                 │
│                                              [Legend]           │
│                                              (bottom-right)     │
└─────────────────────────────────────────────────────────────────┘
```

### Mobile Layout (< 640px)
**When Panel is Expanded:**
```
┌─────────────────────────────────────────┐
│ [Parameters Panel - full width]         │
│  (square edges, scrollable)             │
├─────────────────────────────────────────┤
│                                         │
│                [MAP]                    │
│  (Navigation & Legend HIDDEN)           │
│                                         │
└─────────────────────────────────────────┘
```

**When Panel is Collapsed:**
```
┌─────────────────────────────────────────┐
│ [Panel Header Only]                     │
├─────────────────────────────────────────┤
│                                         │
│                [MAP]                    │
│                                         │
│ [Legend]                   [Navigation] │
│ (bottom-left)              (bottom-right)│
└─────────────────────────────────────────┘
```

### Component-Specific Responsive Behavior

| Component | Mobile (< 640px) | Desktop (≥ 640px) |
|-----------|------------------|-------------------|
| **ParametersPanel** | Full-width, square edges, top edge-to-edge | 540px wide, rounded corners, floating |
| **NavigationWidget** | Hidden when panel open; bottom-right when collapsed | Always visible, top-right |
| **Legend** | Hidden when panel open; bottom-left when collapsed | Always visible, bottom-right |
| **CurveEditor** | Scales to fit container width, 220px height | 490×260px fixed |
| **Dropdowns** | Stacked vertically | Side-by-side |

### Panel Scrolling
- Panel has `max-height: calc(100vh - 24px)` to fit viewport
- Internal content scrolls when exceeding max height
- Custom purple-themed scrollbar (6px wide)

### State Management
- `isPanelCollapsed` state in AppContext controls panel expand/collapse
- NavigationWidget and Legend read this state to show/hide on mobile

## UI Components

### Accessibility Analysis Panel (`ParametersPanel.tsx`)
Main control panel (top-left on desktop, top full-width on mobile, collapsible):
- **Container**: Glass panel with backdrop blur, max-height with internal scroll
- **Title**: "Accessibility Analysis" (text-xl on mobile, text-2xl on desktop, clickable to collapse)
- **Mode Toggle** (`AnalysisModeToggle.tsx`): Buildings | Grid buttons
  - Active mode: Purple background (#7c3aed), white text
  - Inactive mode: Grey background, grey text
- **Section A - Introduction**: Brief explanation + master equation display (context-sensitive)
- **Section B - Parameters** (mode-dependent):
  - **Buildings mode**: Two dropdowns (stacked on mobile, side-by-side on desktop)
    - Amenity Type (j): Land use category selector
    - Attractivity (Att_j): Floor area / Volume / Count
  - **Grid mode**: Custom Amenities count + "Clear all" button
    - Shows loading indicator when computing full network matrix
- **Section C - Distance Decay Function**: Interactive curve editor (shared across modes)

### Curve Editor (`CurveEditor/`)
Tabbed SVG-based curve editor (responsive: 490×260px desktop, scales on mobile):

**Tab Navigation**:
- Custom | Negative Exponential | Exponential Power
- Active tab: Purple text + bottom border (#7c3aed)

**Graph Area** (shared across tabs):
- **Grid**: White lines on transparent background
- **Axes**: Labels only (no frame border)
  - X-axis: "Distance (m) → d_ij" (0-2000m)
  - Y-axis: "Willingness to Travel → f(d_ij)" (0-1.00)
- **Curve**: Purple (#562fae), strokeWidth 3
- **Curve Explorer** (on hover): Crosshairs with value labels
  - Dashed vertical/horizontal lines to curve intersection
  - Purple circle at intersection, purple rounded labels showing d_ij and f(d_ij)

**Custom Tab**:
- Draggable control points: White fill, purple outline
- **Presets**: Exponential (default), Power, Linear, Step, Constant (with "Presets:" label above)
  - Exponential: approximates negative exponential f(d) = e^(-0.003·d) - **default on startup**
  - Power: approximates exponential power f(d) = e^(-(d/700)^2)
- **Interactions**: Double-click to add point, right-click to remove, drag to move

**Negative Exponential Tab**:
- Equation: f(d_ij) = e^(-α·d_ij) (Times New Roman, 24px, italic)
- Input field: α (decay rate), default 0.003

**Exponential Power Tab**:
- Equation: f(d_ij) = e^{-(d_ij/b)^c} (Times New Roman, 24px, italic)
- Input fields: b (scale) default 700, c (shape) default 2

### Navigation Widget (`NavigationWidget.tsx`)
Map controls (top-right on desktop, bottom-right on mobile when panel collapsed):
- **Responsive**: Hidden on mobile when panel is expanded
- **View Buttons**: Top View, Perspective, Reset (with inline SVG icons)
- **Active State**: Grey background (#e5e7eb) indicates current view
- **Zoom Controls**: +/- buttons (font-size 24px)
- Uses MapContext for view state tracking

### Measurement Widget (`MeasurementWidget.tsx`)
Distance measurement tool (positioned below navigation widget):
- **Responsive**: Same visibility rules as NavigationWidget
- **Toggle Button**: Ruler icon, active state highlighted
- **Behavior**:
  - Click to activate measurement mode (cursor becomes crosshair)
  - Click map to place point A, click again for point B
  - Both network and euclidean paths displayed simultaneously
  - Drag markers to update measurements live
  - Third click starts new measurement
  - Escape key or toggle button to deactivate
- **Colors**: Uses ACCENT_COLOR (#5631ad) and ACCENT_COLOR_2 (#fcdb02) from constants

### Legend (`Legend.tsx`)
Score color scale (bottom-right on desktop, bottom-left on mobile when panel collapsed):
- **Responsive**: Hidden on mobile when panel is expanded
- **Buildings mode**:
  - Selected Amenity Indicator: Yellow (#fcdb02) circle + amenity type name (or "Custom Pins")
  - Other Amenities Indicator: Grey (#a0a0a0) circle + "Other Amenities" label
- **Grid mode**:
  - Custom Amenities Indicator: Yellow (#fcdb02) circle + amenity count
  - Hexagon Grid Indicator: Gradient circle + "Hexagon Grid" label
- **Divider**: Thin grey line separating indicators from score gradient
- **Title**: "Accessibility Score" (text-base)
- **Gradient Bar**: Fully rounded (pill-shaped), Purple (#4A3AB4) → Orange (#FD681D) → Red (#FD1D1D)
  - White vertical marker line indicates average score position
- **Labels**:
  - Row 1: Low/High labels with min/max raw score values aligned below
  - Row 2: Average score with "avg" suffix, positioned below the marker (only shown when range > 0)

### App Info (`AppInfo.tsx`)
Version and credits display (bottom-left corner, always visible):
- **Line 1**: `v2026.1 | CC BY-NC 4.0 | Martin Bielik • Collaborators ▾`
- **Line 2**: `in partnership with InfAU & DecodingSpaces`
- **Version**: Links to GitHub repository
- **License**: CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial)
- **Author**: Links to GitHub repository
- **Collaborators**: Click to expand/collapse list
- **Partners**: Abbreviated names link to partner websites, full names shown as tooltip
  - InfAU: Bauhaus-Universität Weimar - Chair Informatics in Architecture and Urbanism
  - DecodingSpaces: DecodingSpaces
- **Styling**: Small text (10px mobile, 12px desktop), white/70 opacity

### Loading Overlay (`LoadingOverlay.tsx`)
Shown during initial data loading:
- **Title**: "Accessibility Analysis Builder"
- **Progress Bar**: Blue bar showing loading percentage
- **Status Text**: Dynamic text describing current loading step

### Map Styling
- **Background**: Medium grey (#b0b0b0)
- **Streets**: White lines with grey shadow
- **Buildings** (visible in Buildings mode):
  - Residential (scored): Purple→Orange→Red gradient
  - Residential (unscored): Light grey (#d0d0d0 - BUILDING_UNSCORED_COLOR)
  - Non-residential: Light grey (#d8d8d8)
  - Selected amenity: Yellow (#fcdb02) with floating effect
- **Hexagon Grid** (visible in Grid mode):
  - ~15m diameter flat-topped hexagons
  - Street-intersecting hexagons excluded (gaps along streets)
  - Hexagons >100m from nearest network node excluded (organic boundary shape)
  - Scored: Purple→Orange→Red gradient (same as buildings)
  - Unscored: Light grey (#cccccc)
  - Thin white outline (0.5px, 50% opacity) for cell boundaries
- **Custom Pins / Amenities**: Yellow markers with black center dot and attractivity box below
  - Attractivity box: Yellow (#fcdb02) fill, black outline (1.5px), rounded corners (10px)
  - Click box to edit attractivity value (input field appears)
  - Pin size scales with attractivity: sqrt formula (1→1.0x, 5→1.5x, 10→1.86x, max 2.0x, min 0.8x)
  - CSS classes: `.custom-pin`, `.attractivity-box`, `.att-value`, `.att-input` (in `index.css`)
- **Hover Popup** (`MapView.tsx`):
  - Shows raw accessibility score on hover over scored buildings (Buildings mode) or hexagons (Grid mode)
  - White rounded box with drop shadow, no visible seam with arrow
  - Text color matches gradient color based on normalized score
  - Cursor: crosshair in Grid mode, pointer on scored elements
  - CSS class: `score-popup` (styled in `index.css`)
- **Layer Visibility**: Buildings hidden in Grid mode, hexagons hidden in Buildings mode
- **Measurement Visualization**:
  - Point markers: Purple (#5631ad) fill, yellow (#fcdb02) border, "A"/"B" labels
  - Network path: Solid 5px line, accent color (#5631ad)
  - Euclidean path: Dashed 5px line, accent2 color (#fcdb02), rounded caps
  - Distance labels: At path midpoints, network (purple bg) on top, euclidean (yellow bg) below
  - Hover on labels brings to foreground
  - Buildings/grid fade to 30% opacity when measurement active
  - CSS classes: `.measurement-marker`, `.measurement-marker-circle`, `.measurement-distance-label`

### CSS (`index.css`)
Key responsive styles:
- **Glass Panel**: `backdrop-filter: blur(16px)`, custom scrollbar styling
- **Math Styling**:
  - `.equation`: Times New Roman, 24px, italic, purple (#5633ac) - for main equation display
  - `.math-var`: Times New Roman, italic, purple (#5633ac) - for inline math variable references (i, j, d_ij, f(d_ij), Att_j, etc.)
- **Mobile Media Query** (`max-width: 639px`):
  - `.glass-panel`: Square corners (`border-radius: 0`)
  - `.param-dropdown`: Smaller font (13px) and padding
  - `.equation`: Reduced font size (18px)
  - `.tab-button`: Compact padding (6px 10px), smaller font (12px)

## Commands
- `npm run dev` — Dev server
- `npm run build` — Production build
- `npm run preview` — Preview build

## Data
- `public/data/weimar-buildings.geojson` — 4,316 buildings with land use areas
- `public/data/weimar-streets.geojson` — 1,183 street segments
- Coordinates in local degree-based system, distances via sqrt((Δlng*111000)²+(Δlat*111000)²)

## Terrain Visualization (Three.js + MapLibre Integration)

### Architecture Overview

The terrain visualization uses Three.js rendered as a MapLibre custom layer. Both systems share the same WebGL context but render sequentially (not a unified 3D scene).

### File Structure

| File | Purpose |
|------|---------|
| `src/visualization/terrainMesh.ts` | Terrain mesh creation, updates, wireframe, and street network |
| `src/visualization/threeJsLayer.ts` | MapLibre custom layer integration for Three.js |
| `src/visualization/shaders/sdfLine.ts` | GLSL shaders for SDF anti-aliased line rendering |
| `src/visualization/SDFLineMaterial.ts` | Custom Three.js material for smooth lines |
| `src/computation/terrainAccessibilityCalc.ts` | Euclidean distance-based accessibility calculation |
| `src/config/constants.ts` | `TERRAIN_SEGMENTS` (64) and `TERRAIN_HEIGHT_SCALE` (200m) |

### Key Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `TERRAIN_SEGMENTS` | 64 | Grid resolution (65×65 = 4,225 vertices) |
| `TERRAIN_HEIGHT_SCALE` | 200 | Meters per unit accessibility score |
| Base height | 10m | Offset above ground level |

### Terrain Mesh Creation (`terrainMesh.ts`)

**`createTerrainMesh(config)`**:
1. Creates `PlaneGeometry(width, height, 64, 64)` → 65×65 = 4,225 vertices
2. Vertices stored in **meters**, centered at origin
3. Stores lng/lat coordinates for each vertex in `mesh.userData.lngLatCoords`
4. Initial height: 10m (base offset above ground)
5. Initial color: grey (#cccccc) for unscored

**`updateTerrainFromAttractors(mesh, attractors, decayFn)`**:
1. Calls `calculateTerrainScores()` to compute accessibility for each vertex
2. Updates vertex heights: `heightMeters = rawScore * TERRAIN_HEIGHT_SCALE + 10`
3. Updates vertex colors using gradient: Purple (#4A3AB4) → Orange (#FD681D) → Red (#FD1D1D)
4. Returns `{ min, max, avg }` statistics for Legend

**`createTerrainWireframe(terrainMesh, color, opacity, lineWidth)`**:
1. Creates `THREE.Mesh` with SDF line material (8,320 line segments)
2. Default: black lines at 30% opacity, 1px width
3. Uses instanced geometry for efficient rendering

**`updateWireframePositions(wireframe, terrainMesh)`**:
- Syncs wireframe vertex positions with terrain mesh after height updates

**`createStreetNetworkLines(terrainMesh, graph, color, opacity, zOffset, lineWidth)`**:
1. Creates `THREE.Mesh` with SDF line material from street graph edges
2. Default: white lines at 90% opacity, 3px width
3. Lines follow terrain height with configurable Z offset (default: 3m)

**`updateStreetNetworkHeights(streetLines, terrainMesh, graph, zOffset)`**:
- Updates street line heights to follow terrain after height changes

### MapLibre Integration (`threeJsLayer.ts`)

**Custom Layer Interface**:
- `onAdd()`: Creates Three.js scene, camera, renderer sharing MapLibre's WebGL context
- `render()`: Called each frame by MapLibre, applies model transform and renders
- `onRemove()`: Disposes of geometry and materials

**Model Transform** (critical for positioning):
```typescript
// Uses MapLibre 5.x getMatrixForModel API
const modelMatrix = map.transform.getMatrixForModel([centerLng, centerLat], 0)
l = new THREE.Matrix4().fromArray(modelMatrix)

// Rotate to orient horizontally (PlaneGeometry is in XY, we need XZ)
const rotationX = new THREE.Matrix4().makeRotationX(-Math.PI / 2)
l.multiply(rotationX)
```

**State Management**:
```typescript
interface ThreeJsTerrainLayerState {
  scene: THREE.Scene
  camera: THREE.Camera
  renderer: THREE.WebGLRenderer
  terrainMesh: THREE.Mesh | null
  wireframeGrid: THREE.Mesh | null       // SDF line mesh
  streetNetworkLines: THREE.Mesh | null  // SDF line mesh
  graph: StreetGraph | null
  config: TerrainMeshConfig | null
  map: maplibregl.Map | null
  visible: boolean
}
```

**Exported Functions**:
- `createThreeJsTerrainLayer(graph)` - Creates the MapLibre custom layer
- `updateTerrainLayer(attractors, decayFn)` - Updates terrain and wireframe positions
- `resetTerrainLayer()` - Resets to flat grey
- `setTerrainLayerVisibility(visible)` - Shows/hides terrain layer
- `setWireframeVisibility(visible)` - Shows/hides wireframe overlay (future UI toggle)
- `isTerrainLayerInitialized()` - Check if ready
- `getTerrainLayerId()` - Returns layer ID for MapLibre

### Terrain Accessibility Calculation (`terrainAccessibilityCalc.ts`)

Uses **Euclidean distance** (not network distance) for real-time performance (~1ms for 4,225 vertices).

```typescript
function calculateTerrainScores(vertices, attractors, decayFn) {
  // For each vertex: score = Σ(attractivity × decayFn(euclideanDistance))
  // Returns { rawScores, normalizedScores, min, max, avg }
}
```

### SDF Line Rendering (`shaders/sdfLine.ts`, `SDFLineMaterial.ts`)

Custom SDF (Signed Distance Field) shaders for smooth anti-aliased line rendering. Used by both the wireframe grid and street network.

**Problem Solved**: WebGL line primitives have no anti-aliasing, resulting in jagged edges. SDF shaders create smooth lines at any zoom level.

**How It Works**:
```
Standard WebGL Lines          SDF Shader Lines
(jagged)                      (smooth)

████████████████              ░▒▓████████████▓▒░
Hard pixel edges              Soft alpha gradient
```

**Vertex Shader** (`sdfLineVertexShader`):
1. Takes line segment endpoints as instanced attributes (`instanceStart`, `instanceEnd`)
2. Transforms to clip space using `projectionMatrix` (full MVP in MapLibre custom layers)
3. Expands each segment into a screen-aligned quad
4. Outputs UV coordinates for fragment shader

**Fragment Shader** (`sdfLineFragmentShader`):
```glsl
float dist = abs(vUV.y);              // 0 at center, 1 at edge
float fw = fwidth(dist);              // Screen-space derivative
float feather = max(fw * 1.5, 0.01);  // Anti-aliasing width
float alpha = 1.0 - smoothstep(1.0 - feather, 1.0 + feather, dist);
```

**SDFLineMaterial Class**:
```typescript
const material = new SDFLineMaterial({
  color: 0xffffff,    // Line color
  linewidth: 2,       // Width in screen pixels
  opacity: 1.0,       // Transparency
  resolution: new THREE.Vector2(w, h)  // Must update each frame!
})
```

**Helper Functions**:
- `createSDFLineGeometry(segments)` - Creates instanced geometry for line segments
- `updateSDFLineGeometry(geometry, segments)` - Updates segment positions

**Usage in Terrain**:
| Component | Color | Width | Opacity |
|-----------|-------|-------|---------|
| Wireframe grid | Black (#000000) | 1px | 30% |
| Street network | White (#ffffff) | 3px | 90% |

### Limitations

| Limitation | Description |
|------------|-------------|
| **Euclidean distance only** | Terrain uses straight-line distance, not street network distance, for performance |
| **No lighting effects** | Uses `MeshBasicMaterial` (vertex colors only), ignores scene lighting |
| **Fixed resolution** | 64×64 grid cannot be changed at runtime |
| **Shared WebGL context** | Must reset WebGL state each frame; attributes re-uploaded every render |
| **No terrain interaction** | Cannot click/hover on terrain mesh (MapLibre events only hit 2D layers) |
| **Sequential rendering** | MapLibre renders first, then Three.js overlays (no depth integration) |
| **SDF resolution dependency** | SDF materials require resolution uniform updates each frame |

### Visual Result

```
BEFORE (flat):                   AFTER (with wireframe):
┌─────────────────────┐          ┌─────────────────────┐
│                     │          │ ┼──┼──┼──┼──┼──┼──┼ │
│   Smooth colored    │          │ │  │  │  │  │  │  │ │
│   surface - looks   │    →     │ ┼──┼──┼──┼──┼──┼──┼ │
│   flat despite      │          │ │  │  │  │  │  │  │ │
│   height variation  │          │ ┼──┼──┼──┼──┼──┼──┼ │
│                     │          │  Grid lines visible │
└─────────────────────┘          └─────────────────────┘
```

## Testing with Playwright MCP

When implementing new features or fixing bugs, use the Playwright MCP tools for browser-based testing:

### Setup
1. Start dev server: `npm run dev`
2. Use `mcp__playwright__browser_navigate` to open the app URL
3. Use `mcp__playwright__browser_snapshot` to capture accessibility tree (preferred over screenshots)

### Common Testing Patterns

**Navigate and verify page loaded:**
```
mcp__playwright__browser_navigate({ url: "http://localhost:5173/Accessibility_UAS_2025/" })
mcp__playwright__browser_snapshot()
```

**Click UI elements:**
```
mcp__playwright__browser_click({ ref: "button_ref", element: "Grid mode button" })
```

**Verify visual changes:**
```
mcp__playwright__browser_take_screenshot({ type: "png", filename: "terrain-test.png" })
```

**Wait for async operations:**
```
mcp__playwright__browser_wait_for({ text: "Loading...", textGone: true })
```

### Test Scenarios for Terrain

1. **Terrain visibility**: Switch to Grid mode → verify terrain layer appears
2. **Wireframe overlay**: Verify grid lines visible on terrain surface
3. **Height updates**: Add/move attractors → verify terrain heights change
4. **Perspective view**: Switch to 3D perspective → verify terrain depth perception
5. **Color gradient**: Verify purple→orange→red gradient on terrain

## Important Notes for AI Operations
- This is NOT an agent simulation — no movement, no animation, no trips
- Never kill all node.exe processes (kills the AI agent process)
- Never mark failed tests as passing
- Always read files before proposing changes
- When referencing mathematical variables in UI text (i, j, d_ij, f(d_ij), Att_j, etc.), wrap them in `<span className="math-var">` to match the equation styling (Times New Roman, italic, purple)
- **Use Playwright MCP for visual testing** - browser automation tools are available via `mcp__playwright__*` functions
