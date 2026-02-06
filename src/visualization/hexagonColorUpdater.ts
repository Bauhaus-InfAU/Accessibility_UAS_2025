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

// Faded color for hexagons outside filter range
const FILTER_FADED_COLOR = '#b8b8b8'

// Standard color expression (no filter)
const STANDARD_HEX_COLOR_EXPRESSION: maplibregl.ExpressionSpecification = [
  'case',
  // Scored hexagons: use gradient
  ['>=', ['get', 'score'], 0],
  [
    'interpolate',
    ['linear'],
    ['get', 'score'],
    0, '#4A3AB4',    // Purple (low)
    0.5, '#FD681D',  // Orange (mid)
    1, '#FD1D1D',    // Red (high)
  ],
  // Unscored hexagons: grey
  '#cccccc',
]

/**
 * Apply filter range to hexagon colors - hexagons outside range are shown as faded grey.
 */
export function applyHexagonFilterOpacity(map: maplibregl.Map, filterRange: FilterRange) {
  if (!map.getLayer('hexagons-fill')) return

  // Build color expression that shows faded grey for hexagons outside the filter range
  const colorExpression: maplibregl.ExpressionSpecification = [
    'case',
    // Unscored hexagons: normal grey
    ['<', ['get', 'score'], 0],
    '#cccccc',
    // Scored hexagons: check if in filter range
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

  map.setPaintProperty('hexagons-fill', 'fill-color', colorExpression)
}

/**
 * Reset hexagon colors to default (no filter)
 */
export function resetHexagonFilterOpacity(map: maplibregl.Map) {
  if (!map.getLayer('hexagons-fill')) return
  map.setPaintProperty('hexagons-fill', 'fill-color', STANDARD_HEX_COLOR_EXPRESSION)
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
