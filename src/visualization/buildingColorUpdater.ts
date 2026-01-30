import type maplibregl from 'maplibre-gl'
import type { Building, LandUse } from '../config/types'

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
 * Sets the 'score' and 'hasSelectedAmenity' properties on each building feature.
 */
export function updateBuildingColors(
  map: maplibregl.Map,
  buildings: Building[],
  scores: Map<string, number>,
  selectedLandUse: LandUse
) {
  const source = map.getSource('buildings') as maplibregl.GeoJSONSource
  if (!source) return

  // For Custom mode, pins are rendered as markers, not building highlights
  const isCustomMode = selectedLandUse === 'Custom'

  const features = buildings.map(b => ({
    ...b.feature,
    properties: {
      ...b.feature.properties,
      id: b.id,
      score: scores.get(b.id) ?? -1,
      isResidential: b.isResidential ? 1 : 0,
      hasSelectedAmenity: isCustomMode ? 0 : ((b.landUseAreas[selectedLandUse] || 0) > 0 ? 1 : 0),
    },
  }))

  source.setData({
    type: 'FeatureCollection',
    features,
  })
}
