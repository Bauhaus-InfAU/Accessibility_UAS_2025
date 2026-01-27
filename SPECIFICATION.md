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

## User Interactions

1. **Define decay function**: Interactive plot (x: distance in meters, y: 0 to 1)
   - Polyline mode: series of draggable points
   - Bezier mode: cubic bezier with control handles
   - Switch between modes
   - Add/remove/drag control points
   - Preset curves: Exponential, Linear, Steep, Step (500m)
2. **Select amenity type**: Which building type to analyze (retail, education, health, etc.)
3. **Custom amenity pins**: Place custom amenity locations on the map
   - Click map to add pin (when "Custom" mode selected)
   - Drag pin to move (automatically re-snaps to street network)
   - Right-click pin to delete
   - "Clear all pins" button to remove all
   - Pins persist when switching to other amenity types
   - Attractivity mode locked to "Count" for custom pins
4. **Choose attractivity mode**: Floor area, volume (area×height), or count (=1)
5. **Navigate 3D model**: Orbit, pan, zoom the city

## Visual Output

### Map Styling
- **Background**: Medium grey (#b0b0b0)
- **Streets**: White lines with grey shadow for depth
- **Buildings**:
  - Scored residential: Purple (#4A3AB4) → Orange (#FD681D) → Red (#FD1D1D) gradient
  - Unscored residential: Light grey (#d0d0d0)
  - Non-residential: Light grey (#d8d8d8)
  - Selected amenity: Yellow (#fcdb02) with 3m floating effect and ground halo

### Custom Pins
- Yellow map markers with black center dot
- Draggable with grab cursor
- Scale on hover for visual feedback

## UI Layout

### Accessibility Analysis Panel (top-left, 680px)
Glassmorphism panel with collapsible content:
1. **Title**: "Accessibility Analysis" (text-2xl, clickable to collapse/expand)
2. **Introduction**: Brief explanation of accessibility concept
3. **Master Equation**: Styled formula display
4. **Parameters** (two dropdowns side-by-side):
   - Amenity Type (j): Land use category selector
   - Attractivity (Att_j): Floor area / Volume / Count
5. **Distance Decay Function** (interactive SVG curve editor):
   - Grid: White lines on transparent background
   - Curve: Purple (#562fae) polyline, strokeWidth 3
   - Control points: White fill, purple outline, strokeWidth 3
   - X-axis: Distance (0-2000m) with label below values
   - Y-axis: f(d) values (0.00-1.00)
   - Preset buttons: Constant, Linear, Exponential, Steep, Step (500m)
   - Instructions: "Double-click to add point. Right-click to remove."

### Navigation Widget (top-right)
- **View buttons** (with inline SVG icons):
  - Top View: 2D grid icon, sets pitch=0
  - Perspective: 3D cube icon, sets pitch=55
  - Reset: Refresh icon, resets to initial bounds/orientation
- **Active state**: Grey background (#e5e7eb) on current view
- **Zoom controls**: +/− buttons (font-size 24px)

### Legend (bottom-right)
- **Title**: "Accessibility Score" (text-base)
- **Gradient bar**: Purple → Orange → Red
- **Labels**: Low/High with min/max raw score values

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

1. **Startup (one-time)**:
   - Load GeoJSON files
   - Build street graph (nodes at intersections, edges with distance weights)
   - Map each building to nearest graph node
   - Run multi-source Dijkstra from all residential nodes (Web Worker)
   - Store distance matrix

2. **On user interaction** (~50ms):
   - For each residential building: sum Att_j × f(d_ij) for all amenities
   - Min-max normalize scores to [0, 1]
   - Update building colors on map

3. **Custom pins calculation**:
   - Each pin snapped to nearest street network node via `findNearestNode()`
   - Uses same distance matrix (source-centric from residential nodes)
   - Each pin has attractivity = 1 (count mode only)
   - Accessibility: `Acc_i = Σ(pins) f(d_i_pin)` where d is network distance

## Technical Constraints

- No backend (GitHub Pages static hosting)
- All computation in-browser
- Web Worker for Dijkstra to avoid UI blocking
- Real-time curve editing feedback (~16ms frame budget for recalculation)
