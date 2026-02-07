import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Building, StreetGraph } from '../config/types'
import { BUILDING_UNSCORED_COLOR } from '../config/constants'
import { createThreeJsTerrainLayer } from './threeJsLayer'

export function createMap(container: HTMLElement, buildings: Building[], graph: StreetGraph | null): maplibregl.Map {
  const map = new maplibregl.Map({
    container,
    style: {
      version: 8,
      sources: {},
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: { 'background-color': '#909090' },
        },
      ],
    },
    center: [0.008, 0.02], // will be overridden by fitBounds
    zoom: 14,
    pitch: 55,
    bearing: -17,
  })

  map.on('load', () => {
    // Add terrain layer first (below everything for Surface mode)
    if (graph) {
      const terrainLayer = createThreeJsTerrainLayer(graph)
      map.addLayer(terrainLayer)
    }

    // Add hexagon layer (for Grid mode)
    addHexagonLayer(map)

    addStreetLayer(map)
    addBuildingLayer(map, buildings)
    fitMapToBounds(map, buildings)
  })

  return map
}

function addHexagonLayer(map: maplibregl.Map) {
  // Add empty hexagon source (data will be set by MapView)
  map.addSource('hexagons', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [],
    },
  })

  // Hexagon fill layer with score-based coloring
  map.addLayer({
    id: 'hexagons-fill',
    type: 'fill',
    source: 'hexagons',
    layout: {
      visibility: 'none', // Hidden by default, Grid mode enables it
    },
    paint: {
      'fill-color': [
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
        // Unscored hexagons: light grey
        '#cccccc',
      ],
      'fill-opacity': 0.85,
    },
  })

  // Hexagon outline layer
  map.addLayer({
    id: 'hexagons-outline',
    type: 'line',
    source: 'hexagons',
    layout: {
      visibility: 'none', // Hidden by default
    },
    paint: {
      'line-color': '#000000',
      'line-width': 0.5,
      'line-opacity': 0.2,
    },
  })
}

function addStreetLayer(map: maplibregl.Map) {
  map.addSource('streets', {
    type: 'geojson',
    data: `${import.meta.env.BASE_URL}data/weimar-streets.geojson`,
  })

  // Street shadow
  map.addLayer({
    id: 'streets-shadow',
    type: 'line',
    source: 'streets',
    paint: {
      'line-color': '#bbb',
      'line-width': 4,
      'line-opacity': 0.3,
    },
  })

  // Street line
  map.addLayer({
    id: 'streets-line',
    type: 'line',
    source: 'streets',
    paint: {
      'line-color': '#ffffff',
      'line-width': 2,
    },
  })
}

function addBuildingLayer(map: maplibregl.Map, buildings: Building[]) {
  // Create GeoJSON features with score property
  const features = buildings.map(b => ({
    ...b.feature,
    properties: {
      ...b.feature.properties,
      id: b.id,
      score: -1, // unscored initially
      isResidential: b.isResidential ? 1 : 0,
      isAnalyzed: b.isResidential ? 1 : 0, // default to residential filter mode
      hasSelectedAmenity: 0, // initially no amenity selected
    },
  }))

  map.addSource('buildings', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features,
    },
  })

  map.addLayer({
    id: 'buildings-fill',
    type: 'fill-extrusion',
    source: 'buildings',
    paint: {
      'fill-extrusion-color': [
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
        BUILDING_UNSCORED_COLOR,
        // Not analyzed - light grey
        '#d8d8d8',
      ],
      'fill-extrusion-height': ['to-number', ['get', 'Height'], 3],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.85,
    },
  })
}

/**
 * Set the visibility of street layers
 */
export function setStreetLayersVisibility(map: maplibregl.Map, visible: boolean) {
  const visibility = visible ? 'visible' : 'none'

  if (map.getLayer('streets-shadow')) {
    map.setLayoutProperty('streets-shadow', 'visibility', visibility)
  }
  if (map.getLayer('streets-line')) {
    map.setLayoutProperty('streets-line', 'visibility', visibility)
  }
}

function fitMapToBounds(map: maplibregl.Map, buildings: Building[]) {
  if (buildings.length === 0) return

  let minLng = Infinity, maxLng = -Infinity
  let minLat = Infinity, maxLat = -Infinity

  for (const b of buildings) {
    const [lng, lat] = b.centroid
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }

  map.fitBounds(
    [[minLng, minLat], [maxLng, maxLat]],
    { padding: 50, duration: 0 }
  )
}
