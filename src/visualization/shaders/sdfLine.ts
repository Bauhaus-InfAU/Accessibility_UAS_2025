/**
 * SDF (Signed Distance Field) Line Shaders
 *
 * These shaders implement smooth anti-aliased lines using the SDF technique.
 * Instead of relying on WebGL line primitives (which have no anti-aliasing),
 * we expand line segments into screen-aligned quads and use smoothstep in
 * the fragment shader to create soft edges.
 *
 * IMPORTANT: These shaders are designed to work with MapLibre custom layers
 * where the camera's projectionMatrix contains the full MVP matrix and
 * modelViewMatrix is identity.
 *
 * Key technique:
 * - Vertex shader: Expands line segments into quads in screen space
 * - Fragment shader: Uses fwidth() for adaptive anti-aliasing
 */

/**
 * Vertex shader for SDF anti-aliased lines (MapLibre custom layer compatible)
 *
 * Takes line segment endpoints as instanced attributes and expands them
 * to screen-aligned quads. The quad is constructed so that:
 * - The line runs along the center of the quad
 * - The quad extends perpendicular to the line by half the line width
 *
 * NOTE: In MapLibre custom layers, projectionMatrix = full MVP matrix,
 * so we use it directly without modelViewMatrix.
 *
 * Outputs vUV where:
 * - vUV.x: position along the line (0 = start, 1 = end)
 * - vUV.y: perpendicular position (-1 = left edge, 0 = center, +1 = right edge)
 */
export const sdfLineVertexShader = `
  // Line segment endpoints (per-instance)
  attribute vec3 instanceStart;
  attribute vec3 instanceEnd;

  // Uniforms
  uniform float linewidth;
  uniform vec2 resolution;

  // Output to fragment shader
  varying vec2 vUV;

  void main() {
    // In MapLibre custom layers, projectionMatrix is the full MVP matrix
    // Transform endpoints to clip space
    vec4 clipStart = projectionMatrix * vec4(instanceStart, 1.0);
    vec4 clipEnd = projectionMatrix * vec4(instanceEnd, 1.0);

    // Convert to NDC (normalized device coordinates)
    vec2 ndcStart = clipStart.xy / clipStart.w;
    vec2 ndcEnd = clipEnd.xy / clipEnd.w;

    // Screen-space direction of the line
    vec2 dir = ndcEnd - ndcStart;
    float len = length(dir);

    // Handle degenerate case (zero-length line)
    if (len < 0.0001) {
      dir = vec2(1.0, 0.0);
    } else {
      dir = normalize(dir);
    }

    // Perpendicular direction (for quad expansion)
    vec2 perp = vec2(-dir.y, dir.x);

    // The input geometry is a unit quad with:
    // position.x: -1 (left edge) or +1 (right edge)
    // position.y: 0 (start) or 1 (end)
    float side = position.x;   // -1 or +1 (perpendicular position)
    float along = position.y;  // 0 or 1 (along the line)

    // Interpolate clip position between start and end
    vec4 clipPos = mix(clipStart, clipEnd, along);

    // Calculate offset in NDC space
    // linewidth is in pixels, convert to NDC
    float aspect = resolution.x / resolution.y;
    vec2 offset = perp * side * linewidth / resolution.y * clipPos.w;

    // Correct for aspect ratio
    offset.x /= aspect;

    // Apply offset
    clipPos.xy += offset;

    gl_Position = clipPos;

    // Pass UV coordinates to fragment shader
    // vUV.y will be used for SDF calculation (distance from line center)
    vUV = vec2(along, side);
  }
`;

/**
 * Fragment shader for SDF anti-aliased lines
 *
 * Uses the perpendicular distance from the line center (vUV.y) to create
 * smooth alpha falloff at the edges. The key is using fwidth() to get
 * screen-space derivatives, which allows for adaptive anti-aliasing that
 * looks good at any scale.
 */
export const sdfLineFragmentShader = `
  precision highp float;

  // Uniforms
  uniform vec3 diffuse;
  uniform float opacity;

  // Input from vertex shader
  varying vec2 vUV;

  void main() {
    // Distance from line center (0 at center, 1 at edge)
    float dist = abs(vUV.y);

    // Adaptive anti-aliasing using screen-space derivatives
    // fwidth() returns the sum of absolute x and y derivatives
    // This gives us a measure of how fast the value changes across pixels
    float fw = fwidth(dist);

    // Feather amount for smooth edges
    // Larger feather = softer edges
    float feather = max(fw * 1.5, 0.01);

    // Smooth alpha falloff at edges
    // smoothstep(edge0, edge1, x) returns 0 when x <= edge0, 1 when x >= edge1
    // We invert it so alpha is 1 at center and 0 at edges
    float alpha = 1.0 - smoothstep(1.0 - feather, 1.0 + feather, dist);

    // Final color with smooth alpha
    gl_FragColor = vec4(diffuse, opacity * alpha);
  }
`;
