# Ticket 002: SDF Line Width Inconsistency Across DPR

| Field | Value |
|-------|-------|
| **Status** | Closed |
| **Created** | 2026-02-02 |
| **Created by** | Claude (Opus 4.5) |
| **Closed** | 2026-02-08 |
| **Closed by** | Claude (Opus 4.6) |

---

## Problem

Street network lines (and other SDF-rendered lines) appear thicker on screens with lower device pixel ratio (DPR). The same `linewidth` value renders visually different depending on the display's pixel density.

**Example:**
- Laptop (2x DPR, 900 CSS height): `resolution.y = 1800` → line appears thin
- External monitor (1x DPR, 900 CSS height): `resolution.y = 900` → line appears 2x thicker

## Root Cause

The SDF shader calculates line width using:

```glsl
vec2 offset = perp * side * linewidth / resolution.y * clipPos.w;
```

- `linewidth` is a fixed value (e.g., 2.5 pixels)
- `resolution.y` is canvas height in **physical pixels** (already scaled by DPR)
- Division by `resolution.y` makes lines thinner on high-DPI screens and thicker on low-DPI screens

This is actually the **opposite** of typical DPR scaling issues. The shader normalizes by physical pixels, so:
- High DPR (more physical pixels) = thinner lines
- Low DPR (fewer physical pixels) = thicker lines

## Resolution

Fixed using **Option C** (CSS pixels for resolution). In the render loop, SDF material resolution is now set to CSS pixels (`canvas.width / dpr`, `canvas.height / dpr`) instead of physical pixels. This makes `linewidth` values represent CSS pixels, producing consistent visual thickness regardless of DPR.

Street network line width restored from `2.5` to `3` (the previous reduction was a workaround).

### Additional fix: Terrain base height removed

The terrain mesh had a 10m base height offset causing the street network to appear shifted vertically compared to Buildings/Grid modes. Removed the offset so terrain sits at ground level (0m) when height scale is 0.

### Files changed

- `src/visualization/threeJsLayer.ts` — CSS pixel resolution for all SDF materials; street z-offset 3→0, line width 2.5→3
- `src/visualization/terrainMesh.ts` — removed 10m base height from mesh creation, update, and reset
