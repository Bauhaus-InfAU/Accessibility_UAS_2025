/**
 * Interpolate between two colors based on a value 0-1.
 * Returns CSS rgb string.
 */
export function interpolateColor(value: number): string {
  // Blue (#2166ac) → White (#f7f7f7) → Red (#b2182b)
  const clampedValue = Math.max(0, Math.min(1, value))

  let r: number, g: number, b: number

  if (clampedValue <= 0.5) {
    // Blue to white
    const t = clampedValue * 2
    r = Math.round(33 + t * (247 - 33))
    g = Math.round(102 + t * (247 - 102))
    b = Math.round(172 + t * (247 - 172))
  } else {
    // White to red
    const t = (clampedValue - 0.5) * 2
    r = Math.round(247 + t * (178 - 247))
    g = Math.round(247 + t * (24 - 247))
    b = Math.round(247 + t * (43 - 247))
  }

  return `rgb(${r}, ${g}, ${b})`
}

export function colorToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
