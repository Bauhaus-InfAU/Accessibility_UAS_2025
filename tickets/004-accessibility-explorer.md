# Ticket 004: Accessibility Explorer Tool

| Field | Value |
|-------|-------|
| **Status** | Open |
| **Created** | 2026-02-09 |
| **Created by** | Martin Bielik |
| **Closed** | - |
| **Closed by** | - |

---

## Summary

A new interactive tool that lets the user place a flag at a specific map location and see a full breakdown of how its accessibility score is computed: the shortest network paths to every amenity, each term of the summation equation, and where each amenity falls on the decay curve.

## Tool Activation

- **Icon**: Triangular flag on a post over an ellipsoid ground shape.
- **Position**: In the tools column, above the measurement tool (below the settings widget).
- **Behavior**: Click to activate explorer mode (cursor becomes crosshair). Click the map to place the explorer flag. Click again to move it. Toggle button or Escape to deactivate (clears all visuals).
- **Flag marker**: Draggable, similar interaction pattern to measurement markers.

## Map Visualization

When the flag is placed, display the shortest network path from the flag location to **every amenity** (predefined or custom pin):

- Each amenity gets a **unique color** from a distinguishable palette (e.g., categorical palette with enough contrast).
- Each path is rendered as a **solid line** using the same styling as the measurement tool's network path (5px width, accent color replaced by the amenity's assigned color).
- Each path has a **distance label** at its midpoint (same style as measurement tool labels, background color matching the amenity's color).
- The flag location snaps to the nearest network node (same as measurement tool behavior).
- Amenity pins adopt their assigned color for the duration of the explorer session (replacing the default yellow).
- In Buildings mode, the analyzed building under the flag gets a highlight/outline.

## Curve Plot Overlay

When the flag is placed, overlay markers on the decay curve plot for each amenity:

- Each amenity is shown as a **colored dot** on the curve at coordinates **(d_ij, f(d_ij))** where d_ij is the network distance from the flag to that amenity.
- Dot color matches the amenity's assigned color on the map.
- Optionally show dashed crosshair lines (like the existing CurveExplorer) from each dot to the axes to read off the distance and decay value.
- If multiple amenities are at similar distances, dots should still be distinguishable (slight vertical offset or tooltip on hover).

## Equation Expansion

When the flag is placed, the accessibility equation in the panel expands to show the full computation:

### Expanded Form (smaller type)

Below the main equation `Acc_i = Σ [Att_j × f(d_ij)]`, show the expanded sum with each term colored to match its amenity:

```
Acc_i = [Att_1 × f(d_i1)] + [Att_2 × f(d_i2)] + ... + [Att_n × f(d_in)]
      = [1 × 0.82]        + [1 × 0.45]        + ... + [2 × 0.12]
      = 0.82 + 0.45 + ... + 0.24
      = 1.51
```

- **Line 1**: Symbolic terms with variable names, each `[Att_j × f(d_ij)]` bracket colored to match the amenity.
- **Line 2**: Substituted numeric values (attractivity × decay value), same coloring.
- **Line 3**: Evaluated partial products, same coloring.
- **Line 4**: Final sum (the raw accessibility score for this location).
- Use smaller type (e.g., 14-16px) to fit without overwhelming the panel.
- The panel should auto-scroll or expand to accommodate the expanded equation.

## Color Consistency

A single categorical color palette is assigned when the flag is placed. The same color for amenity _j_ is used across:

1. The network path line on the map
2. The distance label background
3. The amenity pin marker
4. The dot on the curve plot
5. The corresponding term brackets in the expanded equation

## Mode Compatibility

- **Buildings mode**: Works with both predefined amenity types and custom pins. Flag location corresponds to a building centroid (snap to nearest analyzed building, or use nearest network node).
- **Grid mode**: Works with custom amenities. Flag location is any point on the map (snaps to nearest network node, score corresponds to the nearest hex cell).
- **Surface mode**: Works with custom amenities. Flag location is any point on the terrain surface.

## Interaction Details

- Only **one flag** can be placed at a time (clicking again moves it).
- Dragging the flag updates all visuals in real-time (paths, labels, plot dots, equation).
- Right-click on flag removes it and clears all explorer visuals.
- Activating the measurement tool while explorer is active should deactivate the explorer (mutually exclusive tools).
- Similarly, activating the explorer while measurement is active should deactivate measurement.

## State Management

New state in `AppContext`:

- `isExplorerActive: boolean` — whether the tool is toggled on
- `explorerLocation: [number, number] | null` — flag lng/lat (null if not placed)
- `explorerResults: ExplorerResult[] | null` — computed paths, distances, decay values per amenity

```typescript
interface ExplorerResult {
  amenityId: string
  amenityLabel: string       // e.g., "Retail" or "Custom Pin 1"
  attractivity: number
  networkDistance: number     // d_ij in meters
  decayValue: number         // f(d_ij)
  partialScore: number       // Att_j × f(d_ij)
  networkPath: [number, number][]  // path coordinates for rendering
  color: string              // assigned palette color
}
```

## Files Likely Affected

| File | Changes |
|------|---------|
| `src/config/types.ts` | Add `ExplorerResult` type |
| `src/config/constants.ts` | Add categorical color palette |
| `src/context/AppContext.tsx` | Add explorer state and actions |
| `src/components/map/MapView.tsx` | Explorer flag marker, path rendering, amenity color override |
| `src/components/panels/ParametersPanel.tsx` | Expanded equation display |
| `src/components/CurveEditor/CurveCanvas.tsx` or new overlay | Amenity dots on curve |
| `src/computation/dijkstraAlgorithm.ts` | Reuse `dijkstraWithPath` for per-amenity paths |
| `src/components/panels/ExplorerWidget.tsx` | New tool button component |
| `src/index.css` | Styles for expanded equation, explorer marker |

## Visual Mockup

```
┌─ Panel ─────────────────────────────────────┐
│  Acc_i = Σ [Att_j × f(d_ij)]               │  ← main equation (normal size)
│                                             │
│  = [1 × f(234m)] + [1 × f(567m)] + ...     │  ← expanded, colored, smaller
│  = [1 × 0.82]    + [1 × 0.45]    + ...     │
│  = 0.82 + 0.45 + ...                       │
│  = 1.51                                    │
│                                             │
│  ┌─ Curve Plot ───────────────────────┐     │
│  │ 1.0 ┬─────────────────────────     │     │
│  │     │╲        ● amenity A (234m)   │     │
│  │ 0.5 │  ╲      ● amenity B (567m)  │     │
│  │     │    ╲───● amenity C (890m)    │     │
│  │ 0.0 └──────────────────────────    │     │
│  │     0   500  1000  1500  2000      │     │
│  └────────────────────────────────────┘     │
└─────────────────────────────────────────────┘

┌─ Map ───────────────────────────────────────┐
│                                             │
│     ● amenity A (colored)                   │
│      ╲ (colored path, 234m label)           │
│       ╲                                     │
│        🚩 explorer flag                     │
│       ╱  ╲                                  │
│      ╱    ╲ (colored path, 890m label)      │
│  (colored path, 567m label)                 │
│    ╱        ╲                               │
│   ● amenity B  ● amenity C                 │
│                                             │
└─────────────────────────────────────────────┘
```

## Open Questions

- **Amenity count limit**: With many predefined amenities (e.g., 50+ retail buildings), rendering all paths simultaneously could be visually cluttered and slow. Consider a max display count (e.g., top 10 by score contribution) with a "show all" toggle, or only show paths for amenities within the decay function's effective range.
- **Performance**: Computing Dijkstra with full path for each amenity separately is O(n × E log V). An alternative is a single Dijkstra from the flag node recording predecessors, then tracing back paths to each amenity node — O(E log V + n × path_length). The latter is much faster.
- **Euclidean fallback**: If the flag is placed far from the street network, the nearest-node snap may produce unintuitive results. Consider showing a warning or limiting placement to locations near the network.
