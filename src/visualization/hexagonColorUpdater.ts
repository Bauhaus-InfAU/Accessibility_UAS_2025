import type maplibregl from 'maplibre-gl'
import type { HexCell } from '../config/types'
import { hexCellsToGeoJSON } from '../data/hexagonGrid'

/**
 * Update hexagon colors on the map based on accessibility scores.
 */
export function updateHexagonColors(
  map: maplibregl.Map,
  hexCells: HexCell[],
  scores: Map<string, number>
) {
  const source = map.getSource('hexagons') as maplibregl.GeoJSONSource
  if (!source) return

  const hexGeoJSON = hexCellsToGeoJSON(hexCells, scores)
  source.setData(hexGeoJSON)
}

/**
 * Set the visibility of hexagon layers
 */
export function setHexagonLayersVisibility(map: maplibregl.Map, visible: boolean) {
  const visibility = visible ? 'visible' : 'none'

  if (map.getLayer('hexagons-fill')) {
    map.setLayoutProperty('hexagons-fill', 'visibility', visibility)
  }
  if (map.getLayer('hexagons-outline')) {
    map.setLayoutProperty('hexagons-outline', 'visibility', visibility)
  }
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
