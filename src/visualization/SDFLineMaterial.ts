/**
 * SDF Line Material
 *
 * A custom Three.js ShaderMaterial that renders smooth anti-aliased lines
 * using the SDF (Signed Distance Field) technique.
 *
 * This material is designed to be used with InstancedBufferGeometry where
 * each instance represents a line segment defined by start and end points.
 *
 * Usage:
 *   const material = new SDFLineMaterial({
 *     color: 0xffffff,
 *     linewidth: 2,
 *     opacity: 0.9,
 *     resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
 *   });
 *
 * The resolution uniform must be updated when the canvas size changes.
 */

import * as THREE from 'three'
import { sdfLineVertexShader, sdfLineFragmentShader } from './shaders/sdfLine'

export interface SDFLineMaterialParameters {
  color?: THREE.ColorRepresentation
  linewidth?: number
  opacity?: number
  resolution?: THREE.Vector2
}

export class SDFLineMaterial extends THREE.ShaderMaterial {
  constructor(parameters?: SDFLineMaterialParameters) {
    const color = parameters?.color ?? 0xffffff
    const linewidth = parameters?.linewidth ?? 2.0
    const opacity = parameters?.opacity ?? 1.0
    const resolution = parameters?.resolution ?? new THREE.Vector2(1, 1)

    super({
      uniforms: {
        diffuse: { value: new THREE.Color(color) },
        linewidth: { value: linewidth },
        opacity: { value: opacity },
        resolution: { value: resolution.clone() }
      },
      vertexShader: sdfLineVertexShader,
      fragmentShader: sdfLineFragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
      // Note: OES_standard_derivatives is enabled by default in WebGL2
      // and Three.js automatically handles it for WebGL1
    })
  }

  // Getter/setter for color
  // Guard against calls during super() constructor before uniforms exist
  get color(): THREE.Color {
    return this.uniforms?.diffuse?.value ?? new THREE.Color(0xffffff)
  }
  set color(value: THREE.ColorRepresentation) {
    if (this.uniforms?.diffuse) {
      this.uniforms.diffuse.value.set(value)
    }
  }

  // Getter/setter for linewidth
  // Guard against calls during super() constructor before uniforms exist
  get linewidth(): number {
    return this.uniforms?.linewidth?.value ?? 2.0
  }
  set linewidth(value: number) {
    if (this.uniforms?.linewidth) {
      this.uniforms.linewidth.value = value
    }
  }

  // Getter/setter for resolution
  // Guard against calls during super() constructor before uniforms exist
  get resolution(): THREE.Vector2 {
    return this.uniforms?.resolution?.value ?? new THREE.Vector2(1, 1)
  }
  set resolution(value: THREE.Vector2) {
    if (this.uniforms?.resolution) {
      this.uniforms.resolution.value.copy(value)
    }
  }

  // Override opacity setter to update uniform
  // Guard against calls during super() constructor before uniforms exist
  set opacity(value: number) {
    if (this.uniforms?.opacity) {
      this.uniforms.opacity.value = value
    }
    super.opacity = value
  }
  get opacity(): number {
    return this.uniforms?.opacity?.value ?? super.opacity
  }
}

/**
 * Create geometry for SDF line rendering.
 *
 * This creates an InstancedBufferGeometry with:
 * - A base quad geometry (4 vertices forming a unit quad)
 * - Instance attributes for line segment endpoints (instanceStart, instanceEnd)
 *
 * @param segments - Array of line segments, each with start and end positions [x, y, z]
 * @returns InstancedBufferGeometry ready for use with SDFLineMaterial
 */
export function createSDFLineGeometry(
  segments: Array<{ start: [number, number, number]; end: [number, number, number] }>
): THREE.InstancedBufferGeometry {
  const geometry = new THREE.InstancedBufferGeometry()

  // Base quad vertices (unit quad that will be expanded in vertex shader)
  // Two triangles forming a quad:
  //   (-1, 0) --- (+1, 0)    <- start end of line segment
  //      |    \    |
  //   (-1, 1) --- (+1, 1)    <- end of line segment
  const quadPositions = new Float32Array([
    -1, 0, 0,  // left-start
    1, 0, 0,   // right-start
    1, 1, 0,   // right-end
    -1, 0, 0,  // left-start (repeated for second triangle)
    1, 1, 0,   // right-end (repeated)
    -1, 1, 0   // left-end
  ])

  geometry.setAttribute('position', new THREE.BufferAttribute(quadPositions, 3))

  // Instance attributes for line segment endpoints
  const instanceCount = segments.length
  const instanceStarts = new Float32Array(instanceCount * 3)
  const instanceEnds = new Float32Array(instanceCount * 3)

  for (let i = 0; i < instanceCount; i++) {
    const seg = segments[i]
    instanceStarts[i * 3 + 0] = seg.start[0]
    instanceStarts[i * 3 + 1] = seg.start[1]
    instanceStarts[i * 3 + 2] = seg.start[2]
    instanceEnds[i * 3 + 0] = seg.end[0]
    instanceEnds[i * 3 + 1] = seg.end[1]
    instanceEnds[i * 3 + 2] = seg.end[2]
  }

  geometry.setAttribute(
    'instanceStart',
    new THREE.InstancedBufferAttribute(instanceStarts, 3)
  )
  geometry.setAttribute(
    'instanceEnd',
    new THREE.InstancedBufferAttribute(instanceEnds, 3)
  )

  return geometry
}

/**
 * Update SDF line geometry with new segment positions.
 *
 * This is useful for updating line heights after terrain changes.
 *
 * @param geometry - The InstancedBufferGeometry to update
 * @param segments - New segment positions
 */
export function updateSDFLineGeometry(
  geometry: THREE.InstancedBufferGeometry,
  segments: Array<{ start: [number, number, number]; end: [number, number, number] }>
): void {
  const instanceStarts = geometry.attributes.instanceStart as THREE.InstancedBufferAttribute
  const instanceEnds = geometry.attributes.instanceEnd as THREE.InstancedBufferAttribute

  const startsArray = instanceStarts.array as Float32Array
  const endsArray = instanceEnds.array as Float32Array

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    startsArray[i * 3 + 0] = seg.start[0]
    startsArray[i * 3 + 1] = seg.start[1]
    startsArray[i * 3 + 2] = seg.start[2]
    endsArray[i * 3 + 0] = seg.end[0]
    endsArray[i * 3 + 1] = seg.end[1]
    endsArray[i * 3 + 2] = seg.end[2]
  }

  instanceStarts.needsUpdate = true
  instanceEnds.needsUpdate = true
}
