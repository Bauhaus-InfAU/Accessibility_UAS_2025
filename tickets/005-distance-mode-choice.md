# Ticket 005: Distance Mode Choice (Euclidean vs Network)

| Field | Value |
|-------|-------|
| **Status** | Closed |
| **Created** | 2026-02-09 |
| **Created by** | Martin Bielik |
| **Closed** | 2026-02-09 |
| **Closed by** | Claude |

---

## Summary

Add a global setting to choose between **Euclidean** and **Network** distance for all accessibility calculations. The setting is exposed via a small expandable menu on the measurement tool widget, styled identically to the analysis mode selector (Buildings / Grid / Surface icon buttons with expand panel).

## UI Design

When the measurement tool button is clicked, a small settings panel expands to the left (same behavior and styling as the SettingsWidget for analysis modes):

```
┌──────────────────────────┬───┐
│  Distance Mode           │ 📏│  ← measurement tool icon (existing)
│  ─────────────────────── │   │
│  ● Network    ○ Euclidean│ < │  ← expand/collapse chevron
└──────────────────────────┴───┘
```

- **Icon column**: The existing ruler icon toggles measurement on/off (unchanged behavior).
- **Expand chevron**: Expands the distance mode panel to the left.
- **Panel content**:
  - Title: "Distance Mode" (using `.panel-title` class)
  - Divider below title
  - Two mode buttons styled as pill toggle (same as Analysis Scope's Residential / All Buildings):
    - **Network** (default) — uses shortest path distance via street graph
    - **Euclidean** — uses straight-line distance
- Active mode: white background, grey text, shadow (same as existing pill toggles).

## Behavior

- The distance mode is a **global setting** that affects all three analysis modes (Buildings, Grid, Surface) and the Accessibility Explorer (ticket 004).
- Changing the mode triggers a full recalculation of accessibility scores.
- The measurement tool itself continues to show **both** network and euclidean paths simultaneously (as it does now) — the distance mode setting only controls which distance metric is used for the **accessibility formula**.

## Computation Changes

### Euclidean Mode

- **Buildings mode**: `d_ij = euclidean(building_i.centroid, amenity_j.centroid)` — no street graph needed.
- **Grid mode**: `d_ij = euclidean(hexCell_i.center, attractor_j.coord)` — no street graph needed.
- **Surface mode**: `d_ij = euclidean(vertex_i.lngLat, attractor_j.coord)` — no street graph needed.
- Euclidean distance formula: `sqrt((Δlng × 111000)² + (Δlat × 111000)²)` (existing `DEGREES_TO_METERS` constant).

### Network Mode (existing behavior, unchanged)

- Uses precomputed distance matrix from Dijkstra via street graph.

## State Management

New state in `AppContext`:

- `distanceMode: 'network' | 'euclidean'` — default: `'network'`
- `setDistanceMode: (mode: 'network' | 'euclidean') => void`

The distance mode feeds into:

- `accessibilityCalc.ts` — Buildings mode calculation
- `gridAccessibilityCalc.ts` — Grid mode calculation
- `terrainAccessibilityCalc.ts` — Surface mode calculation
- Accessibility Explorer (ticket 004) — path display and score breakdown

## Integration with Measurement Tool

The measurement tool's existing behavior (showing both network and euclidean paths with labels) remains unchanged. The distance mode panel is purely a settings control that happens to be co-located with the measurement tool for thematic grouping (both relate to distance).

When measurement is active:
- Measurement visuals work as before (both path types shown).
- The distance mode setting can still be changed while measuring.
- The active distance mode could optionally be visually emphasized in the measurement display (e.g., the active mode's path rendered bolder or the inactive one rendered more transparently), but this is not required for the initial implementation.

## Files Likely Affected

| File | Changes |
|------|---------|
| `src/config/types.ts` | Add `DistanceMode` type |
| `src/context/AppContext.tsx` | Add `distanceMode` state and setter |
| `src/components/panels/MeasurementWidget.tsx` | Expand to include distance mode panel |
| `src/computation/accessibilityCalc.ts` | Accept distance mode, add euclidean path |
| `src/computation/gridAccessibilityCalc.ts` | Accept distance mode, add euclidean path |
| `src/computation/terrainAccessibilityCalc.ts` | Accept distance mode, add euclidean path |
| `src/components/map/MapView.tsx` | Pass distance mode to calculation effects |
| `src/index.css` | Styles for expanded measurement panel (reuse settings widget patterns) |

## Dependencies

- None for the core distance mode feature.
- Ticket 004 (Accessibility Explorer) should respect this setting for its path computations and score breakdown.

## Open Questions

- **Loading indicator**: Euclidean mode skips the Dijkstra precomputation entirely. Switching from Network to Euclidean should be instant. Switching back to Network may need to trigger the distance matrix computation if it was not previously cached.
- **Curve plot x-axis**: When switching distance modes, the distances to amenities change. The curve plot x-axis label could indicate which distance metric is in use (e.g., "Network Distance (m)" vs "Euclidean Distance (m)").
- **Legend / indicator**: Consider showing a small badge or label somewhere (e.g., near the equation or in the legend) indicating the active distance mode so users don't forget which mode they're in.
