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
- **Distance Decay Curve**: Polyline or Bezier curve editor with preset options
- **Amenity Selection**: 14 predefined land use types from Weimar data
- **Custom Pins**: User-placed amenity markers on the map (click to add, drag to move, right-click to delete)
- **Attractivity Modes**: Floor area, volume, or count-based weighting
- **3D Visualization**: Buildings colored by accessibility score (purple=low, red=high)
- **Building Hover**: Hover over scored buildings to see raw accessibility score in popup

## Project Structure
```
src/
├── config/          # Types (LandUse, CustomPin, Building) + constants
├── data/            # GeoJSON loading, building/street processing, graph building
├── computation/     # Dijkstra worker, distance matrix, accessibility calc, curve eval
├── components/      # React UI (App, CurveEditor, panels, map)
│   ├── CurveEditor/ # CurveCanvas (grid/axes), PolylineEditor (interactive curve)
│   ├── panels/      # ParametersPanel, NavigationWidget, Legend, dropdowns
│   └── map/         # MapView (includes custom pin marker management)
├── visualization/   # MapLibre setup + building color updates
├── context/         # React Context (AppContext stores scores + rawAccessibilityScores, MapContext)
└── lib/             # Utilities
```

## UI Components

### Accessibility Analysis Panel (`ParametersPanel.tsx`)
Main control panel (top-left, 680px wide, collapsible):
- **Title**: "Accessibility Analysis" (text-2xl, clickable to collapse)
- **Section A - Introduction**: Brief explanation + master equation display
- **Section B - Parameters**: Two dropdowns side-by-side
  - Amenity Type (j): Land use category selector
  - Attractivity (Att_j): Floor area / Volume / Count
- **Divider**: Horizontal line separator
- **Section C - Distance Decay Function**: Interactive curve editor

### Curve Editor (`CurveEditor/`)
SVG-based interactive plot (620×360px):
- **Grid**: White lines on transparent background
- **Axes**: Labels only (no frame border)
  - X-axis: Distance values (0-2000m), "Distance (m)" label below
  - Y-axis: f(d) values (0-1.00)
- **Curve**: Purple (#562fae) polyline, strokeWidth 3
- **Control Points**: White fill, purple (#562fae) outline, strokeWidth 3
- **Presets**: Constant, Linear, Exponential, Steep, Step (500m)
- **Interactions**: Double-click to add point, right-click to remove, drag to move

### Navigation Widget (`NavigationWidget.tsx`)
Map controls (top-right):
- **View Buttons**: Top View, Perspective, Reset (with inline SVG icons)
- **Active State**: Grey background (#e5e7eb) indicates current view
- **Zoom Controls**: +/- buttons (font-size 24px)
- Uses MapContext for view state tracking

### Legend (`Legend.tsx`)
Score color scale (bottom-right):
- **Title**: "Accessibility Score" (text-base)
- **Gradient**: Purple (#4A3AB4) → Orange (#FD681D) → Red (#FD1D1D)
- **Labels**: Low/High + min/max raw score values

### Map Styling
- **Background**: Medium grey (#b0b0b0)
- **Streets**: White lines with grey shadow
- **Buildings**:
  - Residential (scored): Purple→Orange→Red gradient
  - Residential (unscored): Light grey (#d0d0d0 - BUILDING_UNSCORED_COLOR)
  - Non-residential: Light grey (#d8d8d8)
  - Selected amenity: Yellow (#fcdb02) with floating effect
- **Building Hover Popup** (`MapView.tsx`):
  - Shows raw accessibility score on hover over scored residential buildings
  - White rounded box with drop shadow, no visible seam with arrow
  - Text color matches building's gradient color based on normalized score
  - Cursor changes to pointer on scored buildings
  - CSS class: `score-popup` (styled in `index.css`)

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
