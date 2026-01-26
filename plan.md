# Implementation Plan

## Phases
1. Project scaffolding (Vite + React + TS + Tailwind) ✅
2. Data layer (types, GeoJSON loading, building/street processing) ✅
3. Distance precomputation (Dijkstra Web Worker) ✅
4. Curve editor (SVG polyline/bezier) ✅
5. Accessibility calculation ✅
6. 3D map visualization (MapLibre) ✅
7. State management + wiring ✅
8. UI assembly ✅
9. GitHub Pages deploy ✅
10. Custom amenity pins feature ✅
    - CustomPin type and 'Custom' land use
    - Pin state management (add/update/remove/clear)
    - MapLibre marker integration (drag, right-click delete)
    - Accessibility calculation from pins
    - UI: pin count display, locked attractivity mode
