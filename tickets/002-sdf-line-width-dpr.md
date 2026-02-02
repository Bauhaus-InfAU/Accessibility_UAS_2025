# Ticket 002: SDF Line Width Inconsistency Across DPR

| Field | Value |
|-------|-------|
| **Status** | Open |
| **Created** | 2026-02-02 |
| **Created by** | Claude (Opus 4.5) |
| **Closed** | - |
| **Closed by** | - |

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

## Quick Fix Applied

Reduced street network line width from `3.5` to `2.5` in `src/visualization/threeJsLayer.ts:172`.

This improves appearance on low-DPR screens but doesn't solve the fundamental inconsistency.

## Potential Solutions

### Option A: Scale linewidth by DPR in the shader

Modify the shader to multiply linewidth by a DPR uniform:

```glsl
uniform float uDpr;
vec2 offset = perp * side * (linewidth * uDpr) / resolution.y * clipPos.w;
```

This would make lines DPR-independent (same visual thickness regardless of display).

**Pros:** Consistent appearance across all displays
**Cons:** Requires shader modification, new uniform

### Option B: Pass DPR-adjusted linewidth from JS

Instead of modifying the shader, adjust the linewidth value in JavaScript:

```typescript
const dpr = window.devicePixelRatio || 1
const adjustedWidth = baseWidth * dpr
material.linewidth = adjustedWidth
```

**Pros:** No shader changes needed
**Cons:** Must update on DPR changes (window move between monitors)

### Option C: Use CSS pixels for resolution

Change how resolution is passed to the shader, using CSS pixels instead of physical pixels:

```typescript
const dpr = window.devicePixelRatio || 1
material.resolution.set(canvas.width / dpr, canvas.height / dpr)
```

**Pros:** Lines scale with DPR naturally
**Cons:** May affect anti-aliasing quality

## Affected Files

- `src/visualization/threeJsLayer.ts` - passes resolution to SDF materials
- `src/visualization/SDFLineMaterial.ts` - the material class
- `src/visualization/shaders/sdfLine.ts` - GLSL shaders
- `src/visualization/terrainMesh.ts` - creates line geometries
