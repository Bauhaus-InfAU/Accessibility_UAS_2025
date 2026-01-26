import type maplibregl from 'maplibre-gl'
import type { Building, LandUse } from '../config/types'

/**
 * Update building colors on the map based on accessibility scores.
 * Sets the 'score' and 'hasSelectedAmenity' properties on each building feature.
 */
export function updateBuildingColors(
  map: maplibregl.Map,
  buildings: Building[],
  scores: Map<string, number>,
  selectedLandUse: LandUse,
  showAmenityPreview: boolean
) {
  const source = map.getSource('buildings') as maplibregl.GeoJSONSource
  if (!source) return

  const features = buildings.map(b => ({
    ...b.feature,
    properties: {
      ...b.feature.properties,
      id: b.id,
      score: scores.get(b.id) ?? -1,
      isResidential: b.isResidential ? 1 : 0,
      hasSelectedAmenity: showAmenityPreview && (b.landUseAreas[selectedLandUse] || 0) > 0 ? 1 : 0,
    },
  }))

  source.setData({
    type: 'FeatureCollection',
    features,
  })
}
