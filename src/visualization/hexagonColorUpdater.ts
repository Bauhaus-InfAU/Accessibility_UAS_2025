import type maplibregl from 'maplibre-gl'
import type { HexCell } from '../config/types'
import { hexCellsToGeoJSON } from '../data/hexagonGrid'

export interface FilterRange {
  minPercent: number  // 0-1
  maxPercent: number  // 0-1
}

/**
 * Update hexagon colors on the map based on accessibility scores.
 * Optionally applies filter range to fade hexagons outside the range.
 */
export function updateHexagonColors(
  map: maplibregl.Map,
  hexCells: HexCell[],
  scores: Map<string, number>,
  filterRange?: FilterRange | null
) {
  const source = map.getSource('hexagons') as maplibregl.GeoJSONSource
  if (!source) return

  const hexGeoJSON = hexCellsToGeoJSON(hexCells, scores)
  source.setData(hexGeoJSON)

  // Apply filter range to opacity if provided
  if (filterRange) {
    applyHexagonFilterOpacity(map, filterRange)
  } else {
    // Reset to default opacity when no filter
    resetHexagonFilterOpacity(map)
  }
}

/**
 * Apply filter range to hexagon opacity - hexagons outside range are faded
 */
export function applyHexagonFilterOpacity(map: maplibregl.Map, filterRange: FilterRange) {
  if (!map.getLayer('hexagons-fill')) return

  // Build expression that fades hexagons outside the filter range
  // score is normalized 0-1, so we compare directly with filter percents
  const opacityExpression: maplibregl.ExpressionSpecification = [
    'case',
    // Unscored hexagons: full opacity (grey)
    ['<', ['get', 'score'], 0],
    0.85,
    // Scored hexagons: check if in filter range
    ['all',
      ['>=', ['get', 'score'], filterRange.minPercent],
      ['<=', ['get', 'score'], filterRange.maxPercent]
    ],
    0.85,
    // Outside filter range: faded
    0.15
  ]

  map.setPaintProperty('hexagons-fill', 'fill-opacity', opacityExpression)
}

/**
 * Reset hexagon opacity to default (no filter)
 */
export function resetHexagonFilterOpacity(map: maplibregl.Map) {
  if (!map.getLayer('hexagons-fill')) return
  map.setPaintProperty('hexagons-fill', 'fill-opacity', 0.85)
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
