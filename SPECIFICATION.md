# DistanceDecayBuilder - Specification

## Purpose

Educational web app for a university course on spatial accessibility. Students interactively define a distance decay function and observe how it affects accessibility scores across a city model.

## Core Formula

```
Acc_i = Σ(j=1 to n) [Att_j * f(d_ij)]
```

- **Acc_i** = Accessibility of location i
- **Att_j** = Attractivity of destination j (floor area, volume, or 1)
- **f(d_ij)** = User-defined distance decay function, graphically specified
- **d_ij** = Shortest path distance from i to j via street network
- **n** = All destinations of the selected amenity type

## Analysis Modes

The app supports two analysis modes, toggled via buttons at the top of the control panel:

### Buildings Mode (default)
Calculates accessibility for residential buildings based on nearby amenities.

### Grid Mode
Calculates accessibility on a hexagonal grid based on user-placed attractors. Useful for understanding how accessibility varies across space without building constraints.

## User Interactions

1. **Switch analysis mode**: Toggle between Buildings and Grid modes
2. **Define decay function**: Interactive plot (x: distance d_ij in meters, y: 0 to 1)
   - Three tabs for different curve definition modes:
     - **Custom**: Polyline editor with draggable control points
     - **Negative Exponential**: f(d_ij) = e^(-α·d_ij)
     - **Exponential Power**: f(d_ij) = e^{-(d_ij/b)^c}
   - Custom mode features:
     - Add/remove/drag control points
     - Preset curves: Exponential (default), Power, Linear, Step (500m), Constant
   - Mathematical modes:
     - Coefficient input fields below the graph
     - Real-time curve preview and accessibility recalculation
3. **Select amenity type** (Buildings mode): Which building type to analyze (retail, education, health, etc.)
4. **Custom amenity pins** (Buildings mode): Place custom amenity locations on the map
   - 2 default pins placed on startup
   - Click map to add pin (when "Custom" mode selected)
   - Drag pin to move (automatically re-snaps to street network)
   - Right-click pin to delete
   - "Clear all pins" button to remove all
   - Pins persist when switching to other amenity types
   - Attractivity mode locked to "Count" for custom pins
5. **Place attractors** (Grid mode): Click map to place attractor points
   - 2 default attractors placed on startup
   - Click map to add attractor
   - Drag attractor to move
   - Right-click attractor to delete
   - "Clear all" button to remove all attractors
   - Each attractor has attractivity = 1
6. **Choose attractivity mode** (Buildings mode): Floor area, volume (area×height), or count (=1)
7. **Navigate 3D model**: Orbit, pan, zoom the city
8. **Measure distances**: Interactive measurement tool to compare network vs euclidean distances
   - Click ruler button (below navigation widget) to activate
   - Click map to place point A, click again to place point B
   - Displays both paths simultaneously:
     - Network path: Solid line following street network (accent color #5631ad)
     - Euclidean path: Dashed straight line (accent2 color #fcdb02)
   - Distance labels at path midpoints (network on top by default)
   - Drag markers to update measurements in real-time
   - Click third time to start new measurement
   - Press Escape or click ruler button to deactivate
   - Buildings/grid fade to 30% opacity during measurement

## Visual Output

### Map Styling
- **Background**: Medium grey (#b0b0b0)
- **Streets**: White lines with grey shadow for depth
- **Buildings**:
  - Scored residential: Purple (#4A3AB4) → Orange (#FD681D) → Red (#FD1D1D) gradient
  - Unscored residential: Light grey (#d0d0d0)
  - Non-residential: Light grey (#d8d8d8)
  - Selected amenity: Yellow (#fcdb02) with 3m floating effect and ground halo

### Custom Pins / Attractors
- Yellow map markers with black center dot
- Draggable with grab cursor
- Scale on hover for visual feedback
- Used for Custom amenity pins (Buildings mode) and attractors (Grid mode)

### Hexagon Grid (Grid Mode)
- ~15m diameter flat-topped hexagons covering the street network area
- Hexagons intersecting streets are excluded (not rendered)
- Hexagons more than 100m from nearest network node are excluded (organic boundary)
- Each hexagon mapped to nearest network node for distance calculation
- Colored by accessibility score: Purple → Orange → Red gradient
- Thin white outline for cell boundaries

### Terrain Mesh (Grid Mode - Alternative Visualization)
A continuous 3D terrain surface rendered using Three.js as a MapLibre custom layer:
- **Mesh resolution**: 65×65 vertices (4,225 points) on a 64×64 segment grid
- **Height mapping**: Normalized score × 200 meters + 10m base (terrain always spans 0-200m regardless of attractor weights)
- **Color gradient**: Same as buildings/hexagons (Purple → Orange → Red)
- **Wireframe overlay**: Black grid lines at 30% opacity to visualize mesh structure
- **Street network overlay**: White lines following terrain height to show connectivity
- **Contour lines**: 10 white contour lines at regular height intervals (like topographic maps)
- **Distance calculation**: Uses network distance via precomputed distance matrix
- **Bounds**: Covers street network area with 100m padding

**Why Three.js instead of MapLibre alone?**

MapLibre GL JS is optimized for 2D map rendering with limited 3D capabilities:
- MapLibre's native 3D is limited to building extrusions (fixed height, no terrain deformation)
- No support for custom vertex-displaced meshes (accessibility terrain surface)
- Line layers use 2D screen-space rendering, not true 3D lines following terrain height

Three.js provides the flexibility needed for:
- Custom geometry with per-vertex height displacement based on accessibility scores
- True 3D lines that follow the terrain surface (wireframe grid, street network)
- Custom shader materials for advanced rendering effects

**Technical integration**:
- Three.js and MapLibre share the same WebGL context via MapLibre's Custom Layer API
- Model matrix from MapLibre's `getMatrixForModel()` API positions the mesh
- Plane geometry rotated -90° around X axis to be horizontal
- Attributes re-uploaded each frame (shared WebGL context requirement)

### SDF Line Rendering (Smooth Anti-Aliased Lines)

**Problem**: Standard WebGL line primitives have no anti-aliasing support, resulting in jagged/pixelated edges that look unprofessional, especially at certain angles and zoom levels. This affects both the terrain wireframe grid and the street network overlay.

```
Standard WebGL Lines          SDF Shader Lines
(jagged)                      (smooth)

████████████████              ░▒▓████████████▓▒░
Hard pixel edges              Soft alpha gradient
```

**Why MapLibre's line rendering couldn't be used**:
- MapLibre renders lines in 2D screen space, not in 3D world space
- Cannot make MapLibre lines follow terrain height (they would float flat above the mesh)
- MapLibre's smooth lines are implemented via SDF shaders internally, but not exposed for custom 3D use

**Solution**: Custom SDF (Signed Distance Field) shaders for Three.js that:
1. Expand line segments into screen-aligned quads (geometry-based thick lines)
2. Use fragment shader with `smoothstep()` and `fwidth()` for adaptive anti-aliasing
3. Work correctly with MapLibre's custom layer projection matrix

**How SDF line rendering works**:

1. **Vertex Shader** - Expands each line segment into a screen-aligned quad:
   - Takes line endpoints as instanced attributes (`instanceStart`, `instanceEnd`)
   - Transforms to clip space, calculates screen-space direction
   - Expands perpendicular to line direction by half the line width
   - Outputs UV coordinates for fragment shader (distance from line center)

2. **Fragment Shader** - Creates smooth edges using signed distance:
   ```glsl
   float dist = abs(vUV.y);              // 0 at center, 1 at edge
   float fw = fwidth(dist);              // Screen-space derivative (adaptive)
   float feather = max(fw * 1.5, 0.01);  // Anti-aliasing width
   float alpha = 1.0 - smoothstep(1.0 - feather, 1.0 + feather, dist);
   ```
   - `fwidth()` returns how fast the distance value changes across pixels
   - This makes anti-aliasing adaptive: more feathering where needed, less where not
   - Result: consistent smooth edges at any zoom level or viewing angle

**Applied to**:
| Component | Color | Width | Opacity | Purpose |
|-----------|-------|-------|---------|---------|
| Wireframe grid | Black | 1px | 30% | Shows mesh structure and terrain deformation |
| Street network | White | 3px | 90% | Shows connectivity following terrain height |
| Contour lines | White | 1px | 30% | Shows elevation levels like topographic maps |

**Key implementation details**:
- Uses instanced rendering (one draw call for all line segments)
- Resolution uniform must be updated each frame for correct screen-space calculations
- Compatible with MapLibre's custom layer projection (uses `projectionMatrix` directly as MVP)

### Measurement Tool
- **Point markers**: Purple circles (#5631ad) with yellow border (#fcdb02), labeled "A" and "B"
- **Network path**: Solid 5px line in accent color (#5631ad), follows street network
- **Euclidean path**: Dashed 5px line in accent2 color (#fcdb02), rounded caps, straight between points
- **Distance labels**: Rounded boxes at path midpoints
  - Network label: Accent background (#5631ad), white text
  - Euclidean label: Accent2 background (#fcdb02), black text
  - Hover brings label to foreground with slight scale effect
- **Visual feedback**: Buildings/grid opacity reduced to 30% when measurement active

## UI Layout

### Responsive Design

The app adapts to different screen sizes:

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Mobile | < 640px | Full-width panels, stacked layouts, conditional visibility |
| Desktop | ≥ 640px | Floating panels, side-by-side layouts |

**Desktop Layout (≥ 640px):**
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

**Mobile Layout (< 640px) - Panel Expanded:**
- Parameters Panel: Full-width, square edges, at top
- Navigation Widget: Hidden
- Legend: Hidden

**Mobile Layout (< 640px) - Panel Collapsed:**
- Parameters Panel: Header only visible at top
- Navigation Widget: Visible at bottom-right
- Legend: Visible at bottom-left

### Accessibility Analysis Panel (top-left on desktop, full-width on mobile)
Glassmorphism panel with collapsible content:
- **Container**: Max-height with internal scrolling, custom purple scrollbar
- **Responsive sizing**: 540px on desktop, 100% width on mobile
- **Corners**: Rounded (16px) on desktop, square on mobile

Content:
1. **Title**: "Accessibility Analysis" (text-xl mobile, text-2xl desktop, clickable to collapse/expand)
2. **Mode Toggle**: Buildings | Grid buttons (purple highlight for active mode)
3. **Introduction**: Brief explanation (context-sensitive based on mode)
4. **Master Equation**: Styled formula display (18px mobile, 24px desktop)
5. **Parameters** (mode-dependent):
   - **Buildings mode**: Two dropdowns (stacked on mobile, side-by-side on desktop)
     - Amenity Type (j): Land use category selector
     - Attractivity (Att_j): Floor area / Volume / Count
   - **Grid mode**: Attractor count display + "Clear all" button
6. **Distance Decay Function f(d_ij)** (tabbed SVG curve editor, shared across modes):
   - **Tab bar**: Custom | Negative Exponential | Exponential Power (compact on mobile)
   - **Graph area** (490×260px desktop, responsive on mobile):
     - Grid: White lines on transparent background
     - Curve: Purple (#562fae), strokeWidth 3
     - X-axis: "Distance (m) → d_ij" (0-2000m)
     - Y-axis: "Willingness to Travel → f(d_ij)" (0.00-1.00)
     - **Curve Explorer** (on hover):
       - Dashed vertical line from mouse X to curve intersection
       - Dashed horizontal line from curve intersection to Y-axis
       - Small purple circle at curve intersection point
       - Purple rounded label on X-axis showing distance (integer meters)
       - Purple rounded label on Y-axis showing f(d_ij) value (2 decimals)
   - **Custom tab**:
     - Control points: White fill, purple outline, strokeWidth 3
     - Preset buttons: Exponential, Power, Linear, Step, Constant (wrap on mobile)
       - Exponential: approximates negative exponential f(d) = e^(-0.003·d)
       - Power: approximates exponential power f(d) = e^(-(d/700)^2)
     - Instructions: "Double-click to add point. Right-click to remove."
   - **Negative Exponential tab**:
     - Equation: f(d_ij) = e^(-α·d_ij) (Times New Roman, 24px desktop/20px mobile, italic)
     - Input: α (decay rate), default 0.003, range 0-0.1
     - Help: "Higher α = faster decay. Typical range: 0.001 to 0.01"
   - **Exponential Power tab**:
     - Equation: f(d_ij) = e^{-(d_ij/b)^c} (Times New Roman, 24px desktop/20px mobile, italic)
     - Inputs: b (scale) default 700, c (shape) default 2
     - Help: "b = distance where f ≈ 0.37 (when c=1). c = shape (1=standard, >1=steeper, <1=flatter)"

### Navigation Widget
- **Position**: Top-right on desktop, bottom-right on mobile (when panel collapsed)
- **Visibility**: Always visible on desktop, hidden on mobile when panel expanded
- **View buttons** (with inline SVG icons):
  - Top View: 2D grid icon, sets pitch=0
  - Perspective: 3D cube icon, sets pitch=55
  - Reset: Refresh icon, resets to initial bounds/orientation
- **Active state**: Grey background (#e5e7eb) on current view
- **Zoom controls**: +/− buttons (font-size 24px)

### Measurement Widget
- **Position**: Below navigation widget (desktop: top-right, mobile: bottom-right when panel collapsed)
- **Visibility**: Same as Navigation Widget
- **Toggle button**: Ruler icon, highlights when active
- **Keyboard shortcut**: Escape key to deactivate

### Legend
- **Position**: Bottom-right on desktop, bottom-left on mobile (when panel collapsed)
- **Visibility**: Always visible on desktop, hidden on mobile when panel expanded
- **Mode-dependent indicators** (circular icons):
  - Buildings mode: Selected amenity indicator (yellow circle) + "Other Amenities" indicator (grey circle)
  - Grid mode: Attractors indicator (yellow circle) + "Hexagon Grid" indicator (gradient circle)
- **Divider**: Thin grey line
- **Title**: "Accessibility Score" (text-base)
- **Gradient bar**: Fully rounded (pill-shaped), Purple → Orange → Red
- **Size**: 224px wide on desktop, 160px on mobile
- **Labels**: Low/High with min/max raw score values (from current mode)

### App Info / Credentials
- **Position**: Bottom-left corner, always visible
- **Styling**: Small text (10px mobile, 12px desktop), white/70 opacity
- **Layout**: Two lines

**Line 1 - Credits:**
- Format: `{VERSION} | {LICENSE} | {AUTHOR} • Collaborators ▾`
- VERSION: Semantic version (e.g., v2026.1), links to GitHub repository
- LICENSE: CC BY-NC 4.0 (Creative Commons Attribution-NonCommercial)
- AUTHOR: Primary author name, links to GitHub repository
- Collaborators: Expandable dropdown listing contributors

**Line 2 - Partnership:**
- Format: `in partnership with {PARTNER_1} & {PARTNER_2}`
- Partner names use abbreviated display text
- Full organization names shown as tooltip on hover
- Each partner name links to their website

**Data Structure (AppInfo.tsx):**
```typescript
const PARTNERS = [
  { name: 'InfAU', fullName: 'Bauhaus-Universität Weimar - Chair Informatics in Architecture and Urbanism', url: '...' },
  { name: 'DecodingSpaces', fullName: 'DecodingSpaces', url: '...' },
]
```

**Partner URLs:**
- InfAU: https://www.uni-weimar.de/en/architecture-and-urbanism/chairs/infau/news/
- DecodingSpaces: https://decodingspaces.de/

## Data

Using Weimar city center data from reference project:
- 4,316 buildings (2,558 residential, various amenity types)
- 1,183 street segments (~46.5 km network)
- 17 land use categories:
  - 14 amenity types: Retail, Food & Beverage, Entertainment, Service, Health, Education, Office, Culture, Civic, Sport, Industrial, Accommodation, Transport
  - Residential (source locations for accessibility)
  - Utilities, Undefined (excluded from analysis)
  - Custom (user-placed pins, not in data)

## Computation

### Startup (one-time)
- Load GeoJSON files
- Build street graph (~960 nodes from 1,183 street segments)
- Map each building to nearest graph node
- Generate hexagon grid (~7,000 cells at 20m diameter, excluding street intersections and cells >100m from network)
- Map each hexagon to nearest network node
- Run multi-source Dijkstra from all residential nodes (Web Worker)
- Store distance matrix for Buildings mode

### Buildings Mode Calculation (~50ms)
- For each residential building: sum Att_j × f(d_ij) for all amenities
- Min-max normalize scores to [0, 1]
- Update building colors on map

### Grid Mode Calculation
- **First entry**: Compute full network matrix (all ~960 nodes to all nodes) via Web Worker
- **On interaction**: For each unique node in hexagon grid:
  - Calculate: `Acc = Σ(attractors) f(d_node_attractor)`
  - Copy score to all hexagons at that node (optimization)
- Min-max normalize scores to [0, 1]
- Update hexagon colors on map

### Custom Pins Calculation (Buildings Mode)
- Each pin snapped to nearest street network node via `findNearestNode()`
- Uses same distance matrix (source-centric from residential nodes)
- Each pin has attractivity = 1 (count mode only)
- Accessibility: `Acc_i = Σ(pins) f(d_i_pin)` where d is network distance

### Terrain Mesh Calculation (Grid Mode)
Uses network distance via precomputed full network matrix:
- Each mesh vertex is mapped to its nearest street network node at creation time
- For each mesh vertex (mapped to node):
  - Calculate: `score = Σ(attractors) attractivity × f(networkDistance)`
- Min-max normalize scores to [0, 1] (terrain height always spans 0-200m range)
- Update vertex heights: `z = normalizedScore × TERRAIN_HEIGHT_SCALE + 10m`
- Update vertex colors using accessibility gradient
- Sync wireframe and contour line positions with mesh

**Network distance benefits**: Terrain now shows organic, street-following accessibility patterns instead of smooth circular patterns. Same distance calculation as hexagon grid.

## Technical Constraints

- No backend (GitHub Pages static hosting)
- All computation in-browser
- Web Worker for Dijkstra to avoid UI blocking
- Real-time curve editing feedback (~16ms frame budget for recalculation)

## Terrain Visualization Limitations

| Limitation | Description | Workaround |
|------------|-------------|------------|
| **No lighting effects** | Uses `MeshBasicMaterial` (ignores scene lighting) | Wireframe overlay and contour lines provide depth perception |
| **Fixed resolution** | 64×64 grid cannot be changed at runtime | Sufficient for current area size |
| **Shared WebGL context** | Must reset WebGL state each frame | Handled automatically in render loop |
| **No terrain interaction** | Cannot click/hover on terrain (MapLibre 2D events only) | Use hexagon grid for interaction |
| **Sequential rendering** | MapLibre renders first, then Three.js overlays | No depth integration between layers |
| **SDF resolution dependency** | SDF line materials require canvas resolution each frame | Updated automatically in render loop |
| **No terrain hover popup** | Terrain mesh doesn't trigger MapLibre events | Hexagon grid shows scores on hover |
