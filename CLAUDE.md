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
- **3D Visualization**: Buildings colored by accessibility score (blue=low, red=high)

## Project Structure
```
src/
├── config/          # Types (LandUse, CustomPin, Building) + constants
├── data/            # GeoJSON loading, building/street processing, graph building
├── computation/     # Dijkstra worker, distance matrix, accessibility calc, curve eval
├── components/      # React UI (App, CurveEditor, panels, map)
│   ├── panels/      # AmenitySelector, AttractivityMode, CurveModeSelector
│   └── map/         # MapView (includes custom pin marker management)
├── visualization/   # MapLibre setup + building color updates
├── context/         # React Context for global state (AppContext)
└── lib/             # Utilities
```

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
