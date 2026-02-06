import type maplibregl from 'maplibre-gl'
import type { Building, LandUse, BuildingFilterMode } from '../config/types'

export interface FilterRange {
  minPercent: number  // 0-1
  maxPercent: number  // 0-1
}

/**
 * Set the visibility of building layers
 */
export function setBuildingLayersVisibility(map: maplibregl.Map, visible: boolean) {
  const visibility = visible ? 'visible' : 'none'

  if (map.getLayer('buildings-fill')) {
    map.setLayoutProperty('buildings-fill', 'visibility', visibility)
  }
  if (map.getLayer('buildings-amenity-halo')) {
    map.setLayoutProperty('buildings-amenity-halo', 'visibility', visibility)
  }
}

/**
 * Update building colors on the map based on accessibility scores.
 * Sets the 'score', 'isAnalyzed', and 'hasSelectedAmenity' properties on each building feature.
 * Optionally applies filter range to fade buildings outside the range.
 */
export function updateBuildingColors(
  map: maplibregl.Map,
  buildings: Building[],
  scores: Map<string, number>,
  selectedLandUse: LandUse,
  buildingFilterMode: BuildingFilterMode,
  filterRange?: FilterRange | null
) {
  const source = map.getSource('buildings') as maplibregl.GeoJSONSource
  if (!source) return

  // For Custom mode, pins are rendered as markers, not building highlights
  const isCustomMode = selectedLandUse === 'Custom'

  const features = buildings.map(b => {
    // Determine if this building is part of the analysis based on filter mode
    let isAnalyzed: boolean
    if (buildingFilterMode === 'residential') {
      isAnalyzed = b.isResidential
    } else {
      // All buildings mode
      if (isCustomMode) {
        // Custom mode: all buildings are analyzed
        isAnalyzed = true
      } else {
        // Predefined amenity: all buildings except the amenity itself
        isAnalyzed = !((b.landUseAreas[selectedLandUse] || 0) > 0)
      }
    }

    return {
      ...b.feature,
      properties: {
        ...b.feature.properties,
        id: b.id,
        score: scores.get(b.id) ?? -1,
        isResidential: b.isResidential ? 1 : 0,
        isAnalyzed: isAnalyzed ? 1 : 0,
        hasSelectedAmenity: isCustomMode ? 0 : ((b.landUseAreas[selectedLandUse] || 0) > 0 ? 1 : 0),
      },
    }
  })

  source.setData({
    type: 'FeatureCollection',
    features,
  })

  // Apply filter range to opacity if provided
  if (filterRange) {
    applyBuildingFilterOpacity(map, filterRange)
  } else {
    // Reset to default opacity when no filter
    resetBuildingFilterOpacity(map)
  }
}

// Faded color for buildings outside filter range (30% visible = blend 70% towards background)
const FILTER_FADED_COLOR = '#b8b8b8'

// Standard color expression (no filter)
const STANDARD_COLOR_EXPRESSION: maplibregl.ExpressionSpecification = [
  'case',
  // Selected amenity buildings: bright yellow
  ['==', ['get', 'hasSelectedAmenity'], 1],
  '#fcdb02',
  // Analyzed buildings with scores (gradient)
  ['all', ['==', ['get', 'isAnalyzed'], 1], ['>=', ['get', 'score'], 0]],
  [
    'interpolate',
    ['linear'],
    ['get', 'score'],
    0, '#4A3AB4',    // Purple (low)
    0.5, '#FD681D',  // Orange (mid)
    1, '#FD1D1D',    // Red (high)
  ],
  // Analyzed but unscored
  ['==', ['get', 'isAnalyzed'], 1],
  '#d0d0d0',
  // Not analyzed - light grey
  '#d8d8d8',
]

/**
 * Apply filter range to building colors - buildings outside range are shown as faded grey.
 * Note: fill-extrusion-opacity doesn't support data expressions, so we modify the color instead.
 */
export function applyBuildingFilterOpacity(map: maplibregl.Map, filterRange: FilterRange) {
  if (!map.getLayer('buildings-fill')) return

  // Build color expression that shows faded grey for buildings outside the filter range
  const colorExpression: maplibregl.ExpressionSpecification = [
    'case',
    // Selected amenity buildings: always bright yellow
    ['==', ['get', 'hasSelectedAmenity'], 1],
    '#fcdb02',
    // Unanalyzed buildings: always normal grey
    ['==', ['get', 'isAnalyzed'], 0],
    '#d8d8d8',
    // Analyzed but no score: normal unscored color
    ['<', ['get', 'score'], 0],
    '#d0d0d0',
    // Analyzed with score - check if in filter range
    ['all',
      ['>=', ['get', 'score'], filterRange.minPercent],
      ['<=', ['get', 'score'], filterRange.maxPercent]
    ],
    // In filter range: use normal gradient
    [
      'interpolate',
      ['linear'],
      ['get', 'score'],
      0, '#4A3AB4',    // Purple (low)
      0.5, '#FD681D',  // Orange (mid)
      1, '#FD1D1D',    // Red (high)
    ],
    // Outside filter range: faded grey
    FILTER_FADED_COLOR
  ]

  map.setPaintProperty('buildings-fill', 'fill-extrusion-color', colorExpression)
}

/**
 * Reset building colors to default (no filter)
 */
export function resetBuildingFilterOpacity(map: maplibregl.Map) {
  if (!map.getLayer('buildings-fill')) return
  map.setPaintProperty('buildings-fill', 'fill-extrusion-color', STANDARD_COLOR_EXPRESSION)
}
