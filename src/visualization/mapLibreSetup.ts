import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Building } from '../config/types'
import { BUILDING_UNSCORED_COLOR } from '../config/constants'

export function createMap(container: HTMLElement, buildings: Building[]): maplibregl.Map {
  const map = new maplibregl.Map({
    container,
    style: {
      version: 8,
      sources: {},
      layers: [
        {
          id: 'background',
          type: 'background',
          paint: { 'background-color': '#f0f0f0' },
        },
      ],
    },
    center: [0.008, 0.02], // will be overridden by fitBounds
    zoom: 14,
    pitch: 55,
    bearing: -17,
  })

  map.addControl(new maplibregl.NavigationControl(), 'top-right')

  map.on('load', () => {
    addStreetLayer(map)
    addBuildingLayer(map, buildings)
    fitMapToBounds(map, buildings)
  })

  return map
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

  // Ground-level halo/glow for selected amenity buildings (rendered BEFORE 3D buildings)
  map.addLayer({
    id: 'buildings-amenity-halo',
    type: 'fill',
    source: 'buildings',
    paint: {
      'fill-color': '#dc2626',  // Tailwind red-600
      'fill-opacity': [
        'case',
        ['==', ['get', 'hasSelectedAmenity'], 1],
        0.6,
        0,
      ],
    },
  })

  map.addLayer({
    id: 'buildings-fill',
    type: 'fill-extrusion',
    source: 'buildings',
    paint: {
      'fill-extrusion-color': [
        'case',
        // Selected amenity buildings: bright amber/gold
        ['==', ['get', 'hasSelectedAmenity'], 1],
        '#f59e0b',  // Tailwind amber-500
        // Residential buildings with scores
        ['all', ['==', ['get', 'isResidential'], 1], ['>=', ['get', 'score'], 0]],
        [
          'interpolate',
          ['linear'],
          ['get', 'score'],
          0, '#2166ac',    // Blue (low)
          0.5, '#f7f7f7',  // White (mid)
          1, '#b2182b',    // Red (high)
        ],
        // Unscored residential
        ['==', ['get', 'isResidential'], 1],
        BUILDING_UNSCORED_COLOR,
        // Non-residential (not selected amenity)
        '#e0ddd8',
      ],
      'fill-extrusion-height': ['to-number', ['get', 'Height'], 3],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.85,
    },
  })
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
