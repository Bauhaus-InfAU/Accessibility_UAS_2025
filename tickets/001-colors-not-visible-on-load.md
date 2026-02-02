# Ticket 001: Accessibility colors not visible on initial load

| Field | Value |
|-------|-------|
| **Status** | Closed |
| **Created** | 2025-01-15 |
| **Created by** | Martin Bielik |
| **Closed** | 2025-01-15 |
| **Closed by** | Martin Bielik |

---

## Problem
Building accessibility colors (blue-to-red gradient) only appear after clicking one of the preset buttons (Exponential, Linear, Steep, Step). On initial page load, buildings remain gray.

## Expected Behavior
Colors should be calculated and displayed automatically after the Dijkstra precomputation completes, without requiring user interaction.

## Root Cause (suspected)
The initial accessibility calculation may run before the MapLibre source is ready, or the color update isn't triggered after the first calculation.

## Location
- Preset buttons: `src/components/CurveEditor/CurveEditor.tsx`
- Color update logic: `src/context/AppContext.tsx` (recalculate effect)
- Map update: `src/components/map/MapView.tsx`

## Fix
Updated `src/components/map/MapView.tsx`:
- Added `mapLoadedRef` to track when map is truly ready
- Memoized `updateColors` callback using `useCallback`
- Map's 'load' event now triggers initial color update
- Color update effect runs whenever scores/settings change AND map is ready
- Proper cleanup of event listener on unmount

### Regression Fix
The initial fix caused the map to recreate on every parameter change because `updateColors` was in the map initialization effect's dependency array.

**Additional fix applied:**
- Added `updateColorsRef` ref to always point to the latest `updateColors` function
- Changed `onLoad` handler to call `updateColorsRef.current()` instead of `updateColors()` directly
- Removed `updateColors` from map initialization effect dependencies: `[isLoading, buildings]`

This ensures the map only initializes once while still calling the latest color update logic when needed.
