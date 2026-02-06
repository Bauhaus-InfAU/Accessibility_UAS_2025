/**
 * Terrain Color Shaders
 *
 * Custom shaders for terrain mesh that enable sharp filter boundaries.
 * Instead of using vertex colors (which interpolate across triangles creating
 * smooth/blurry boundaries), we pass the normalized score as a vertex attribute
 * and compute the final color per-pixel in the fragment shader.
 *
 * This allows the filter threshold check to happen at each pixel, creating
 * sharp boundaries between filtered (grey) and non-filtered (colored) areas.
 *
 * Works with MapLibre custom layers where projectionMatrix = full MVP matrix.
 */

/**
 * Vertex shader for terrain mesh with per-vertex score
 *
 * Passes the normalized score to the fragment shader for per-pixel color calculation.
 * The score interpolates smoothly across triangles, but the color decision is binary
 * in the fragment shader, creating sharp filter boundaries.
 */
export const terrainColorVertexShader = `
  // Per-vertex score (0-1 normalized accessibility)
  attribute float score;

  // Output to fragment shader
  varying float vScore;

  void main() {
    // Pass score to fragment shader (will be interpolated across triangle)
    vScore = score;

    // Standard position transform
    // In MapLibre custom layers, projectionMatrix is the full MVP matrix
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * Fragment shader for terrain mesh with filter-aware coloring
 *
 * Computes the gradient color per-pixel based on interpolated score.
 * When filtering is active, applies a binary threshold check to create
 * sharp boundaries between colored and grey areas.
 *
 * The key insight: score interpolates smoothly, but the if/else check
 * happens per-pixel, creating a sharp boundary at the filter threshold.
 */
export const terrainColorFragmentShader = `
  precision highp float;

  // Filter range uniforms
  uniform float minFilter;
  uniform float maxFilter;
  uniform bool filterActive;
  uniform bool hasAttractors;

  // Gradient colors (Purple -> Orange -> Red)
  // Note: These are provided in linear space by Three.js
  uniform vec3 purpleColor;
  uniform vec3 orangeColor;
  uniform vec3 redColor;
  uniform vec3 greyColor;

  // General material properties
  uniform float opacity;

  // Input from vertex shader
  varying float vScore;

  /**
   * Convert linear RGB to sRGB (apply gamma correction)
   * This is needed because Three.js converts uniform colors to linear space,
   * but we want to output sRGB for correct display.
   */
  vec3 linearToSRGB(vec3 linear) {
    // Standard sRGB gamma curve approximation
    return pow(linear, vec3(1.0 / 2.2));
  }

  /**
   * Compute gradient color for a normalized score (0-1)
   * Purple (0.0) -> Orange (0.5) -> Red (1.0)
   */
  vec3 computeGradientColor(float score) {
    float t = clamp(score, 0.0, 1.0);

    if (t < 0.5) {
      // Purple -> Orange
      float t2 = t * 2.0;
      return mix(purpleColor, orangeColor, t2);
    } else {
      // Orange -> Red
      float t2 = (t - 0.5) * 2.0;
      return mix(orangeColor, redColor, t2);
    }
  }

  void main() {
    vec3 color;

    // If no attractors, show grey
    if (!hasAttractors) {
      color = greyColor;
    }
    // If filter is active and score is outside range, show grey
    else if (filterActive && (vScore < minFilter || vScore > maxFilter)) {
      color = greyColor;
    }
    // Otherwise, compute gradient color from score
    else {
      color = computeGradientColor(vScore);
    }

    // Apply gamma correction to convert from linear to sRGB for display
    color = linearToSRGB(color);

    gl_FragColor = vec4(color, opacity);
  }
`
