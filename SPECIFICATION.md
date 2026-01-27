# DistanceDecayBuilder - Specification

## Purpose

Educational web app for a university course on spatial accessibility. Students interactively define a distance decay function and observe how it affects accessibility scores across a city model.

## Core Formula

```
Acc_i = Σ(j=0 to n) [Att_j * f(d_ij)]
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
- ~20m diameter flat-topped hexagons covering the street network area
- Hexagons intersecting streets are excluded (not rendered)
- Each hexagon mapped to nearest network node for distance calculation
- Colored by accessibility score: Purple → Orange → Red gradient
- Thin white outline for cell boundaries

## UI Layout

### Accessibility Analysis Panel (top-left, 680px)
Glassmorphism panel with collapsible content:
1. **Title**: "Accessibility Analysis" (text-2xl, clickable to collapse/expand)
2. **Mode Toggle**: Buildings | Grid buttons (purple highlight for active mode)
3. **Introduction**: Brief explanation (context-sensitive based on mode)
4. **Master Equation**: Styled formula display
5. **Parameters** (mode-dependent):
   - **Buildings mode**: Two dropdowns side-by-side
     - Amenity Type (j): Land use category selector
     - Attractivity (Att_j): Floor area / Volume / Count
   - **Grid mode**: Attractor count display + "Clear all" button
6. **Distance Decay Function f(d_ij)** (tabbed SVG curve editor, shared across modes):
   - **Tab bar**: Custom | Negative Exponential | Exponential Power
   - **Graph area** (620×360px):
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
     - Preset buttons: Exponential, Power, Linear, Step, Constant (with "Presets:" label)
       - Exponential: approximates negative exponential f(d) = e^(-0.003·d)
       - Power: approximates exponential power f(d) = e^(-(d/700)^2)
     - Instructions: "Double-click to add point. Right-click to remove."
   - **Negative Exponential tab**:
     - Equation: f(d_ij) = e^(-α·d_ij) (Times New Roman, 24px, italic)
     - Input: α (decay rate), default 0.003, range 0-0.1
     - Help: "Higher α = faster decay. Typical range: 0.001 to 0.01"
   - **Exponential Power tab**:
     - Equation: f(d_ij) = e^{-(d_ij/b)^c} (Times New Roman, 24px, italic)
     - Inputs: b (scale) default 700, c (shape) default 2
     - Help: "b = distance where f ≈ 0.37 (when c=1). c = shape (1=standard, >1=steeper, <1=flatter)"

### Navigation Widget (top-right)
- **View buttons** (with inline SVG icons):
  - Top View: 2D grid icon, sets pitch=0
  - Perspective: 3D cube icon, sets pitch=55
  - Reset: Refresh icon, resets to initial bounds/orientation
- **Active state**: Grey background (#e5e7eb) on current view
- **Zoom controls**: +/− buttons (font-size 24px)

### Legend (bottom-right)
- **Mode-dependent indicators**:
  - Buildings mode: Selected amenity indicator (yellow) + "Other Amenities" indicator (grey)
  - Grid mode: Attractors indicator (yellow) + "Hexagon Grid" indicator (gradient)
- **Divider**: Thin grey line
- **Title**: "Accessibility Score" (text-base)
- **Gradient bar**: Purple → Orange → Red
- **Labels**: Low/High with min/max raw score values (from current mode)

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
- Generate hexagon grid (~7,000 cells at 20m diameter, excluding street intersections)
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

## Technical Constraints

- No backend (GitHub Pages static hosting)
- All computation in-browser
- Web Worker for Dijkstra to avoid UI blocking
- Real-time curve editing feedback (~16ms frame budget for recalculation)
