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

/**
 * Apply filter range to building opacity - buildings outside range are faded
 */
export function applyBuildingFilterOpacity(map: maplibregl.Map, filterRange: FilterRange) {
  if (!map.getLayer('buildings-fill')) return

  // Build expression that fades buildings outside the filter range
  // score is normalized 0-1, so we compare directly with filter percents
  const opacityExpression: maplibregl.ExpressionSpecification = [
    'case',
    // Selected amenity buildings: always full opacity
    ['==', ['get', 'hasSelectedAmenity'], 1],
    0.85,
    // Unanalyzed buildings: always full opacity (grey)
    ['==', ['get', 'isAnalyzed'], 0],
    0.85,
    // Analyzed but no score: full opacity
    ['<', ['get', 'score'], 0],
    0.85,
    // Analyzed with score: check if in filter range
    ['all',
      ['>=', ['get', 'score'], filterRange.minPercent],
      ['<=', ['get', 'score'], filterRange.maxPercent]
    ],
    0.85,
    // Outside filter range: faded
    0.15
  ]

  map.setPaintProperty('buildings-fill', 'fill-extrusion-opacity', opacityExpression)
}

/**
 * Reset building opacity to default (no filter)
 */
export function resetBuildingFilterOpacity(map: maplibregl.Map) {
  if (!map.getLayer('buildings-fill')) return
  map.setPaintProperty('buildings-fill', 'fill-extrusion-opacity', 0.85)
}
