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
- Tailwind CSS (styling)
- SVG (interactive curve editor)
- Web Worker (Dijkstra precomputation)

## Key Features
- **Analysis Modes**: Toggle between Buildings and Grid modes
  - Buildings mode: Accessibility for residential buildings based on amenities
  - Grid mode: Accessibility on hexagonal grid based on user-placed attractors
- **Distance Decay Curve**: Tabbed editor with three modes:
  - Custom: Polyline editor with draggable points and presets
  - Negative Exponential: f(d_ij) = e^(-α·d_ij) with α coefficient input
  - Exponential Power: f(d_ij) = e^{-(d_ij/b)^c} with b and c coefficient inputs
- **Amenity Selection**: 14 predefined land use types from Weimar data
- **Custom Pins**: User-placed amenity markers on the map (click to add, drag to move, right-click to delete)
- **Grid Attractors**: User-placed attractor points for Grid mode (same interactions as custom pins)
- **Attractivity Modes**: Floor area, volume, or count-based weighting
- **3D Visualization**: Buildings colored by accessibility score (purple=low, red=high)
- **Hexagon Grid**: ~20m diameter hexagons colored by accessibility (Grid mode)
- **Hover Popups**: Show raw accessibility score on hover (buildings or hexagons)

## Project Structure
```
src/
├── config/          # Types (LandUse, CustomPin, Building, CurveTabMode, AnalysisMode, HexCell, GridAttractor) + constants
├── data/            # GeoJSON loading, building/street processing, graph building, hexagon grid
│   ├── dataLoader.ts      # GeoJSON file loading
│   ├── buildingStore.ts   # Building processing and land use queries
│   ├── streetGraph.ts     # Street network graph construction
│   └── hexagonGrid.ts     # Hexagon grid generation and street intersection detection
├── computation/     # Dijkstra worker, distance matrix, accessibility calc, curve eval
│   ├── dijkstra.worker.ts      # Web Worker for shortest path computation
│   ├── dijkstraAlgorithm.ts    # Dijkstra implementation
│   ├── distanceMatrix.ts       # Distance matrix computation (buildings + full network)
│   ├── accessibilityCalc.ts    # Buildings mode accessibility calculation
│   ├── gridAccessibilityCalc.ts # Grid mode accessibility calculation
│   └── curveEvaluator.ts       # Distance decay function evaluation
├── components/      # React UI (App, CurveEditor, panels, map)
│   ├── CurveEditor/ # Tabbed curve editor with multiple modes
│   │   ├── CurveEditor.tsx      # Main component with tabs
│   │   ├── CurveCanvas.tsx      # SVG grid/axes (shared), mouse tracking
│   │   ├── CurveExplorer.tsx    # Crosshair overlay with value labels
│   │   ├── PolylineEditor.tsx   # Custom mode - draggable points
│   │   ├── MathCurveDisplay.tsx # Mathematical function curve renderer
│   │   └── CoefficientInputs.tsx # Parameter inputs for math functions
│   ├── panels/      # ParametersPanel, NavigationWidget, Legend, dropdowns, AnalysisModeToggle
│   └── map/         # MapView (includes custom pin/attractor marker management)
├── visualization/   # MapLibre setup + color updates
│   ├── mapLibreSetup.ts         # Map initialization, layers (buildings, hexagons, streets)
│   ├── buildingColorUpdater.ts  # Building color updates based on scores
│   └── hexagonColorUpdater.ts   # Hexagon color updates and layer visibility
├── context/         # React Context (AppContext stores scores + curve state + grid state, MapContext)
└── lib/             # Utilities
```

## UI Components

### Accessibility Analysis Panel (`ParametersPanel.tsx`)
Main control panel (top-left, 680px wide, collapsible):
- **Title**: "Accessibility Analysis" (text-2xl, clickable to collapse)
- **Mode Toggle** (`AnalysisModeToggle.tsx`): Buildings | Grid buttons
  - Active mode: Purple background (#7c3aed), white text
  - Inactive mode: Grey background, grey text
- **Section A - Introduction**: Brief explanation + master equation display (context-sensitive)
- **Section B - Parameters** (mode-dependent):
  - **Buildings mode**: Two dropdowns side-by-side
    - Amenity Type (j): Land use category selector
    - Attractivity (Att_j): Floor area / Volume / Count
  - **Grid mode**: Attractor count + "Clear all" button
    - Shows loading indicator when computing full network matrix
- **Divider**: Horizontal line separator
- **Section C - Distance Decay Function**: Interactive curve editor (shared across modes)

### Curve Editor (`CurveEditor/`)
Tabbed SVG-based curve editor (620×360px):

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
- **Presets**: Exponential, Power, Linear, Step, Constant (with "Presets:" label above)
  - Exponential: approximates negative exponential f(d) = e^(-0.003·d)
  - Power: approximates exponential power f(d) = e^(-(d/700)^2)
- **Interactions**: Double-click to add point, right-click to remove, drag to move

**Negative Exponential Tab**:
- Equation: f(d_ij) = e^(-α·d_ij) (Times New Roman, 24px, italic)
- Input field: α (decay rate), default 0.003

**Exponential Power Tab**:
- Equation: f(d_ij) = e^{-(d_ij/b)^c} (Times New Roman, 24px, italic)
- Input fields: b (scale) default 700, c (shape) default 2

### Navigation Widget (`NavigationWidget.tsx`)
Map controls (top-right):
- **View Buttons**: Top View, Perspective, Reset (with inline SVG icons)
- **Active State**: Grey background (#e5e7eb) indicates current view
- **Zoom Controls**: +/- buttons (font-size 24px)
- Uses MapContext for view state tracking

### Legend (`Legend.tsx`)
Score color scale (bottom-right), mode-dependent:
- **Buildings mode**:
  - Selected Amenity Indicator: Yellow (#fcdb02) rounded box + amenity type name (or "Custom Pins")
  - Other Amenities Indicator: Grey (#a0a0a0) rounded box + "Other Amenities" label
- **Grid mode**:
  - Attractors Indicator: Yellow (#fcdb02) rounded box + attractor count
  - Hexagon Grid Indicator: Gradient box + "Hexagon Grid" label
- **Divider**: Thin grey line separating indicators from score gradient
- **Title**: "Accessibility Score" (text-base)
- **Gradient**: Purple (#4A3AB4) → Orange (#FD681D) → Red (#FD1D1D)
- **Labels**: Low/High + min/max raw score values (from current mode)

### Map Styling
- **Background**: Medium grey (#b0b0b0)
- **Streets**: White lines with grey shadow
- **Buildings** (visible in Buildings mode):
  - Residential (scored): Purple→Orange→Red gradient
  - Residential (unscored): Light grey (#d0d0d0 - BUILDING_UNSCORED_COLOR)
  - Non-residential: Light grey (#d8d8d8)
  - Selected amenity: Yellow (#fcdb02) with floating effect
- **Hexagon Grid** (visible in Grid mode):
  - ~20m diameter flat-topped hexagons
  - Street-intersecting hexagons excluded (gaps along streets)
  - Scored: Purple→Orange→Red gradient (same as buildings)
  - Unscored: Light grey (#cccccc)
  - Thin white outline (0.5px, 50% opacity) for cell boundaries
- **Custom Pins / Attractors**: Yellow markers with black center dot (same for both modes)
- **Hover Popup** (`MapView.tsx`):
  - Shows raw accessibility score on hover over scored buildings (Buildings mode) or hexagons (Grid mode)
  - White rounded box with drop shadow, no visible seam with arrow
  - Text color matches gradient color based on normalized score
  - Cursor: crosshair in Grid mode, pointer on scored elements
  - CSS class: `score-popup` (styled in `index.css`)
- **Layer Visibility**: Buildings hidden in Grid mode, hexagons hidden in Buildings mode

## Commands
- `npm run dev` — Dev server
- `npm run build` — Production build
- `npm run preview` — Preview build

## Data
- `public/data/weimar-buildings.geojson` — 4,316 buildings with land use areas
- `public/data/weimar-streets.geojson` — 1,183 street segments
- Coordinates in local degree-based system, distances via sqrt((Δlng*111000)²+(Δlat*111000)²)

## Important Notes for AI Operations
- This is NOT an agent simulation — no movement, no animation, no trips
- Never kill all node.exe processes (kills the AI agent process)
- Never mark failed tests as passing
- Always read files before proposing changes
