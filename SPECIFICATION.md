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
2. **Select amenity type**: Which building type to analyze (retail, education, health, etc.)
3. **Choose attractivity mode**: Floor area, volume (area×height), or count (=1)
4. **Navigate 3D model**: Orbit, pan, zoom the city

## Visual Output

Buildings colored by accessibility score:
- Blue = low accessibility
- Red = high accessibility
- Gray = non-residential (not scored)

## Data

Using Weimar city center data from reference project:
- 4,316 buildings (2,558 residential, various amenity types)
- 1,183 street segments (~46.5 km network)
- 16 land use categories

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

## Technical Constraints

- No backend (GitHub Pages static hosting)
- All computation in-browser
- Web Worker for Dijkstra to avoid UI blocking
- Real-time curve editing feedback (~16ms frame budget for recalculation)
