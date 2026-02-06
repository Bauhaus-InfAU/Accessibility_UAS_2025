/**
 * Terrain Color Material
 *
 * A custom Three.js ShaderMaterial for terrain mesh rendering with sharp filter boundaries.
 * Uses per-pixel color calculation to create sharp boundaries between filtered and
 * non-filtered areas, unlike vertex colors which interpolate and create blurry boundaries.
 *
 * Usage:
 *   const material = new TerrainColorMaterial()
 *   material.setFilterRange(0.3, 0.7, true)  // Filter to show only 30%-70% scores
 */

import * as THREE from 'three'
import { terrainColorVertexShader, terrainColorFragmentShader } from './shaders/terrainColor'

export class TerrainColorMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      uniforms: {
        // Filter range
        minFilter: { value: 0.0 },
        maxFilter: { value: 1.0 },
        filterActive: { value: false },
        hasAttractors: { value: false },

        // Gradient colors (Purple -> Orange -> Red)
        purpleColor: { value: new THREE.Color(0x4A3AB4) },
        orangeColor: { value: new THREE.Color(0xFD681D) },
        redColor: { value: new THREE.Color(0xFD1D1D) },
        greyColor: { value: new THREE.Color(0x909090) },  // Grey for filtered-out areas

        // Material properties
        opacity: { value: 1.0 }
      },
      vertexShader: terrainColorVertexShader,
      fragmentShader: terrainColorFragmentShader,
      transparent: true,
      side: THREE.DoubleSide
    })
  }

  /**
   * Set the filter range for terrain visualization.
   * Areas with scores outside [minPercent, maxPercent] will be shown in grey.
   *
   * @param minPercent - Minimum score (0-1) to show in color
   * @param maxPercent - Maximum score (0-1) to show in color
   * @param active - Whether filtering is active
   */
  setFilterRange(minPercent: number, maxPercent: number, active: boolean): void {
    this.uniforms.minFilter.value = minPercent
    this.uniforms.maxFilter.value = maxPercent
    this.uniforms.filterActive.value = active
  }

  /**
   * Set whether there are attractors (to show grey when no attractors)
   */
  setHasAttractors(hasAttractors: boolean): void {
    this.uniforms.hasAttractors.value = hasAttractors
  }

  /**
   * Set the material opacity
   */
  setOpacity(opacity: number): void {
    this.uniforms.opacity.value = opacity
    this.transparent = opacity < 1
  }

  /**
   * Get current opacity
   */
  getOpacity(): number {
    return this.uniforms.opacity.value
  }
}
