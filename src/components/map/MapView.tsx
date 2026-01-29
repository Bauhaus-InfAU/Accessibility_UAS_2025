import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import { useAppContext } from '../../context/AppContext'
import { useMapContext } from '../../context/MapContext'
import { createMap } from '../../visualization/mapLibreSetup'
import { updateBuildingColors } from '../../visualization/buildingColorUpdater'
import { updateHexagonColors, setHexagonLayersVisibility, setBuildingLayersVisibility } from '../../visualization/hexagonColorUpdater'
import { calculateEuclideanDistance, formatDistance, getPathMidpoint, getLineMidpoint } from '../../computation/measurementCalc'
import { ACCENT_COLOR, ACCENT_COLOR_2 } from '../../config/constants'

// Calculate color from normalized score (0-1) using the accessibility gradient
// Purple (#4A3AB4) → Orange (#FD681D) → Red (#FD1D1D)
function getScoreColor(normalizedScore: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  const t = clamp(normalizedScore)

  // Colors: purple at 0, orange at 0.5, red at 1
  const purple = { r: 0x4A, g: 0x3A, b: 0xB4 }
  const orange = { r: 0xFD, g: 0x68, b: 0x1D }
  const red = { r: 0xFD, g: 0x1D, b: 0x1D }

  let r: number, g: number, b: number
  if (t < 0.5) {
    // Interpolate purple → orange
    const t2 = t * 2
    r = Math.round(purple.r + (orange.r - purple.r) * t2)
    g = Math.round(purple.g + (orange.g - purple.g) * t2)
    b = Math.round(purple.b + (orange.b - purple.b) * t2)
  } else {
    // Interpolate orange → red
    const t2 = (t - 0.5) * 2
    r = Math.round(orange.r + (red.r - orange.r) * t2)
    g = Math.round(orange.g + (red.g - orange.g) * t2)
    b = Math.round(orange.b + (red.b - orange.b) * t2)
  }

  return `rgb(${r}, ${g}, ${b})`
}

// Calculate pin scale based on attractivity (min 0.8, max 2.0)
function getPinScale(attractivity: number): number {
  const minScale = 0.8
  const maxScale = 2.0
  // Use square root for visible differences at low values
  // attractivity 1 -> scale 1.0, attractivity 5 -> scale 1.5, attractivity 10 -> scale 1.86
  if (attractivity <= 0) return minScale
  const sqrtScale = 0.6 + 0.4 * Math.sqrt(attractivity)
  return Math.min(maxScale, Math.max(minScale, sqrtScale))
}

// SVG for custom pin marker with attractivity box
function createPinElement(
  attractivity: number,
  onAttractivityChange: (newValue: number) => void
): HTMLDivElement {
  const scale = getPinScale(attractivity)
  const width = Math.round(24 * scale)
  const height = Math.round(32 * scale)

  const el = document.createElement('div')
  el.className = 'custom-pin'
  el.setAttribute('data-scale', scale.toString())
  el.innerHTML = `
    <svg width="${width}" height="${height}" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z" fill="#fcdb02" stroke="#000" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="4" fill="#000"/>
    </svg>
    <div class="attractivity-box">
      <span class="att-value">${attractivity}</span>
    </div>
  `

  const attBox = el.querySelector('.attractivity-box') as HTMLDivElement
  const attValue = attBox.querySelector('.att-value') as HTMLSpanElement

  // Handle click on attractivity box to edit
  attBox.addEventListener('click', (e) => {
    e.stopPropagation()

    // Already editing, don't create another input
    if (attBox.querySelector('input')) return

    const currentValue = parseFloat(attValue.textContent || '1')
    attValue.style.display = 'none'

    const input = document.createElement('input')
    input.type = 'number'
    input.className = 'att-input'
    input.value = currentValue.toString()
    input.min = '0'
    input.step = '0.1'
    attBox.appendChild(input)
    input.focus()
    input.select()

    const finishEditing = () => {
      const newValue = parseFloat(input.value)
      if (!isNaN(newValue) && newValue >= 0) {
        attValue.textContent = newValue.toString()
        onAttractivityChange(newValue)
      }
      input.remove()
      attValue.style.display = ''
    }

    input.addEventListener('blur', finishEditing)
    input.addEventListener('keydown', (ke) => {
      if (ke.key === 'Enter') {
        finishEditing()
      } else if (ke.key === 'Escape') {
        input.remove()
        attValue.style.display = ''
      }
    })
  })

  return el
}

// Update attractivity value and pin size on existing marker element
function updatePinAttractivity(el: HTMLElement, attractivity: number): void {
  const attValue = el.querySelector('.att-value') as HTMLSpanElement
  if (attValue) {
    attValue.textContent = attractivity.toString()
  }

  // Update pin size
  const svg = el.querySelector('svg')
  if (svg) {
    const scale = getPinScale(attractivity)
    const width = Math.round(24 * scale)
    const height = Math.round(32 * scale)
    svg.setAttribute('width', width.toString())
    svg.setAttribute('height', height.toString())
    el.setAttribute('data-scale', scale.toString())
  }
}

// Create measurement marker element (purple circle with A/B label)
function createMeasurementMarkerElement(label: 'A' | 'B'): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'measurement-marker'
  el.innerHTML = `
    <div class="measurement-marker-circle">${label}</div>
  `
  return el
}

// Create distance label element for map
function createDistanceLabelElement(distance: string, bgColor: string, textColor: string = 'white', zIndex: number = 1): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'measurement-distance-label'
  el.style.backgroundColor = bgColor
  el.style.color = textColor
  el.style.zIndex = zIndex.toString()
  el.textContent = distance
  return el
}

// Update distance label content
function updateDistanceLabelElement(el: HTMLElement, distance: string): void {
  el.textContent = distance
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapLoadedRef = useRef(false)
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const attractorMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const measurementMarkersRef = useRef<Map<'A' | 'B', maplibregl.Marker>>(new Map())
  const distanceLabelMarkersRef = useRef<Map<'network' | 'euclidean', maplibregl.Marker>>(new Map())
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const {
    buildings,
    accessibilityScores,
    rawAccessibilityScores,
    isLoading,
    selectedLandUse,
    customPins,
    addCustomPin,
    updateCustomPin,
    updateCustomPinAttractivity,
    removeCustomPin,
    // Grid mode state
    analysisMode,
    hexCells,
    gridAttractors,
    gridAccessibilityScores,
    gridRawAccessibilityScores,
    addGridAttractor,
    updateGridAttractor,
    updateGridAttractorAttractivity,
    removeGridAttractor,
    // Measurement tool state
    isMeasurementActive,
    measurementPointA,
    measurementPointB,
    networkPath,
    networkDistance,
    addMeasurementPoint,
    updateMeasurementPoint,
    setMeasurementActive,
  } = useAppContext()
  const { setMapInstance, setInitialBounds } = useMapContext()

  const isCustomMode = selectedLandUse === 'Custom'
  const isGridMode = analysisMode === 'grid'

  // Memoized color update function for buildings
  const updateColors = useCallback(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current || buildings.length === 0) return
    if (map.getSource('buildings')) {
      updateBuildingColors(map, buildings, accessibilityScores, selectedLandUse)
    }
  }, [buildings, accessibilityScores, selectedLandUse])

  // Memoized color update function for hexagons
  const updateHexColors = useCallback(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current || hexCells.length === 0) return
    if (map.getSource('hexagons')) {
      updateHexagonColors(map, hexCells, gridAccessibilityScores)
    }
  }, [hexCells, gridAccessibilityScores])

  // Ref to always access latest updateColors in onLoad handler
  const updateColorsRef = useRef(updateColors)
  updateColorsRef.current = updateColors

  const updateHexColorsRef = useRef(updateHexColors)
  updateHexColorsRef.current = updateHexColors

  // Refs for event handlers
  const addCustomPinRef = useRef(addCustomPin)
  const updateCustomPinRef = useRef(updateCustomPin)
  const removeCustomPinRef = useRef(removeCustomPin)
  const isCustomModeRef = useRef(isCustomMode)
  const isGridModeRef = useRef(isGridMode)
  const rawAccessibilityScoresRef = useRef(rawAccessibilityScores)
  const accessibilityScoresRef = useRef(accessibilityScores)
  const gridRawAccessibilityScoresRef = useRef(gridRawAccessibilityScores)
  const gridAccessibilityScoresRef = useRef(gridAccessibilityScores)
  const addGridAttractorRef = useRef(addGridAttractor)
  const updateGridAttractorRef = useRef(updateGridAttractor)
  const updateGridAttractorAttractivityRef = useRef(updateGridAttractorAttractivity)
  const removeGridAttractorRef = useRef(removeGridAttractor)
  const updateCustomPinAttractivityRef = useRef(updateCustomPinAttractivity)
  const isMeasurementActiveRef = useRef(isMeasurementActive)
  const addMeasurementPointRef = useRef(addMeasurementPoint)
  const updateMeasurementPointRef = useRef(updateMeasurementPoint)

  addCustomPinRef.current = addCustomPin
  updateCustomPinRef.current = updateCustomPin
  updateCustomPinAttractivityRef.current = updateCustomPinAttractivity
  removeCustomPinRef.current = removeCustomPin
  isCustomModeRef.current = isCustomMode
  isGridModeRef.current = isGridMode
  rawAccessibilityScoresRef.current = rawAccessibilityScores
  accessibilityScoresRef.current = accessibilityScores
  gridRawAccessibilityScoresRef.current = gridRawAccessibilityScores
  gridAccessibilityScoresRef.current = gridAccessibilityScores
  addGridAttractorRef.current = addGridAttractor
  updateGridAttractorRef.current = updateGridAttractor
  updateGridAttractorAttractivityRef.current = updateGridAttractorAttractivity
  removeGridAttractorRef.current = removeGridAttractor
  isMeasurementActiveRef.current = isMeasurementActive
  addMeasurementPointRef.current = addMeasurementPoint
  updateMeasurementPointRef.current = updateMeasurementPoint

  // Initialize map (only depends on isLoading and buildings)
  useEffect(() => {
    if (isLoading || !containerRef.current || buildings.length === 0) return
    if (mapRef.current) return // already initialized

    const map = createMap(containerRef.current, buildings, hexCells)
    mapRef.current = map
    mapLoadedRef.current = false
    setMapInstance(map)

    const onLoad = () => {
      mapLoadedRef.current = true
      // Compute and store initial bounds from buildings
      if (buildings.length > 0) {
        let minLng = Infinity, maxLng = -Infinity
        let minLat = Infinity, maxLat = -Infinity
        for (const b of buildings) {
          const [lng, lat] = b.centroid
          if (lng < minLng) minLng = lng
          if (lng > maxLng) maxLng = lng
          if (lat < minLat) minLat = lat
          if (lat > maxLat) maxLat = lat
        }
        setInitialBounds([[minLng, minLat], [maxLng, maxLat]])
      }
      // Use ref to get latest updateColors
      updateColorsRef.current()

      // Building hover handlers for score popup
      map.on('mousemove', 'buildings-fill', (e) => {
        // Skip if in grid mode
        if (isGridModeRef.current) return

        const feature = e.features?.[0]
        if (!feature?.properties) return

        const { id, isResidential } = feature.properties
        // Skip non-residential buildings
        if (!isResidential) {
          if (popupRef.current) {
            popupRef.current.remove()
            popupRef.current = null
          }
          map.getCanvas().style.cursor = isCustomModeRef.current ? 'crosshair' : ''
          return
        }

        const rawScore = rawAccessibilityScoresRef.current.get(id)
        const normalizedScore = accessibilityScoresRef.current.get(id)
        // Skip unscored buildings
        if (rawScore === undefined || normalizedScore === undefined) {
          if (popupRef.current) {
            popupRef.current.remove()
            popupRef.current = null
          }
          map.getCanvas().style.cursor = isCustomModeRef.current ? 'crosshair' : ''
          return
        }

        // Show pointer cursor for scored buildings
        map.getCanvas().style.cursor = 'pointer'

        // Get color matching the building's color
        const color = getScoreColor(normalizedScore)

        // Create or update popup
        if (!popupRef.current) {
          popupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: 'score-popup',
          })
        }

        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(`<div class="score-value" style="color: ${color}">${rawScore.toFixed(1)}</div>`)
          .addTo(map)
      })

      map.on('mouseleave', 'buildings-fill', () => {
        if (popupRef.current) {
          popupRef.current.remove()
          popupRef.current = null
        }
        if (!isGridModeRef.current) {
          map.getCanvas().style.cursor = isCustomModeRef.current ? 'crosshair' : ''
        }
      })

      // Hexagon hover handlers for score popup
      map.on('mousemove', 'hexagons-fill', (e) => {
        // Skip if not in grid mode
        if (!isGridModeRef.current) return

        const feature = e.features?.[0]
        if (!feature?.properties) return

        const { id } = feature.properties
        const rawScore = gridRawAccessibilityScoresRef.current.get(id)
        const normalizedScore = gridAccessibilityScoresRef.current.get(id)

        // Skip unscored hexagons
        if (rawScore === undefined || normalizedScore === undefined) {
          if (popupRef.current) {
            popupRef.current.remove()
            popupRef.current = null
          }
          map.getCanvas().style.cursor = 'crosshair'
          return
        }

        // Show pointer cursor for scored hexagons
        map.getCanvas().style.cursor = 'pointer'

        // Get color matching the hexagon's color
        const color = getScoreColor(normalizedScore)

        // Create or update popup
        if (!popupRef.current) {
          popupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: 'score-popup',
          })
        }

        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(`<div class="score-value" style="color: ${color}">${rawScore.toFixed(1)}</div>`)
          .addTo(map)
      })

      map.on('mouseleave', 'hexagons-fill', () => {
        if (popupRef.current) {
          popupRef.current.remove()
          popupRef.current = null
        }
        if (isGridModeRef.current) {
          map.getCanvas().style.cursor = 'crosshair'
        }
      })
    }

    // Handle map click for adding pins, attractors, or measurement points
    const onClick = (e: maplibregl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat

      // Measurement mode takes priority over other click handlers
      if (isMeasurementActiveRef.current) {
        addMeasurementPointRef.current([lng, lat])
        return
      }

      // Grid mode: add attractor
      if (isGridModeRef.current) {
        addGridAttractorRef.current([lng, lat])
        return
      }

      // Buildings mode: add custom pin (only in Custom amenity mode)
      if (isCustomModeRef.current) {
        addCustomPinRef.current([lng, lat])
      }
    }

    map.on('load', onLoad)
    map.on('click', onClick)

    return () => {
      map.off('load', onLoad)
      map.off('click', onClick)
      // Clean up markers
      for (const marker of markersRef.current.values()) {
        marker.remove()
      }
      markersRef.current.clear()
      for (const marker of attractorMarkersRef.current.values()) {
        marker.remove()
      }
      attractorMarkersRef.current.clear()
      // Clean up measurement markers
      for (const marker of measurementMarkersRef.current.values()) {
        marker.remove()
      }
      measurementMarkersRef.current.clear()
      // Clean up distance label markers
      for (const marker of distanceLabelMarkersRef.current.values()) {
        marker.remove()
      }
      distanceLabelMarkersRef.current.clear()
      // Clean up popup
      if (popupRef.current) {
        popupRef.current.remove()
        popupRef.current = null
      }
      map.remove()
      mapRef.current = null
      mapLoadedRef.current = false
      setMapInstance(null)
    }
  }, [isLoading, buildings, hexCells, setMapInstance, setInitialBounds])

  // Update building colors when scores or settings change
  useEffect(() => {
    updateColors()
  }, [updateColors])

  // Update hexagon colors when grid scores change
  useEffect(() => {
    updateHexColors()
  }, [updateHexColors])

  // Update layer visibility when analysis mode changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current) return

    if (isGridMode) {
      setBuildingLayersVisibility(map, false)
      setHexagonLayersVisibility(map, true)
    } else {
      setHexagonLayersVisibility(map, false)
      setBuildingLayersVisibility(map, true)
    }
  }, [isGridMode])

  // Sync markers with customPins (only show when in Custom mode AND not in Grid mode)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current) return

    // Hide markers if not in Custom mode OR if in Grid mode
    if (!isCustomMode || isGridMode) {
      for (const marker of markersRef.current.values()) {
        marker.remove()
      }
      markersRef.current.clear()
      return
    }

    const existingIds = new Set(markersRef.current.keys())
    const currentIds = new Set(customPins.map(p => p.id))

    // Remove markers for deleted pins
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        const marker = markersRef.current.get(id)
        marker?.remove()
        markersRef.current.delete(id)
      }
    }

    // Add or update markers for current pins
    for (const pin of customPins) {
      let marker = markersRef.current.get(pin.id)

      if (!marker) {
        // Create new marker with attractivity
        const el = createPinElement(pin.attractivity, (newValue) => {
          updateCustomPinAttractivityRef.current(pin.id, newValue)
        })
        marker = new maplibregl.Marker({
          element: el,
          draggable: true,
          anchor: 'bottom',
        })
          .setLngLat(pin.coord)
          .addTo(map)

        // Handle drag end
        marker.on('dragend', () => {
          const lngLat = marker!.getLngLat()
          updateCustomPinRef.current(pin.id, [lngLat.lng, lngLat.lat])
        })

        // Handle right-click to delete
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault()
          e.stopPropagation()
          removeCustomPinRef.current(pin.id)
        })

        markersRef.current.set(pin.id, marker)
      } else {
        // Update existing marker position and attractivity
        marker.setLngLat(pin.coord)
        const el = marker.getElement()
        updatePinAttractivity(el, pin.attractivity)
      }
    }
  }, [customPins, isCustomMode, isGridMode])

  // Sync attractor markers with gridAttractors (only show when in Grid mode)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current) return

    // If not in Grid mode, remove all attractor markers
    if (!isGridMode) {
      for (const marker of attractorMarkersRef.current.values()) {
        marker.remove()
      }
      attractorMarkersRef.current.clear()
      return
    }

    const existingIds = new Set(attractorMarkersRef.current.keys())
    const currentIds = new Set(gridAttractors.map(a => a.id))

    // Remove markers for deleted attractors
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        const marker = attractorMarkersRef.current.get(id)
        marker?.remove()
        attractorMarkersRef.current.delete(id)
      }
    }

    // Add or update markers for current amenities
    for (const amenity of gridAttractors) {
      let marker = attractorMarkersRef.current.get(amenity.id)

      if (!marker) {
        // Create new marker with attractivity
        const el = createPinElement(amenity.attractivity, (newValue) => {
          updateGridAttractorAttractivityRef.current(amenity.id, newValue)
        })
        marker = new maplibregl.Marker({
          element: el,
          draggable: true,
          anchor: 'bottom',
        })
          .setLngLat(amenity.coord)
          .addTo(map)

        // Handle drag end
        marker.on('dragend', () => {
          const lngLat = marker!.getLngLat()
          updateGridAttractorRef.current(amenity.id, [lngLat.lng, lngLat.lat])
        })

        // Handle right-click to delete
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault()
          e.stopPropagation()
          removeGridAttractorRef.current(amenity.id)
        })

        attractorMarkersRef.current.set(amenity.id, marker)
      } else {
        // Update existing marker position and attractivity
        marker.setLngLat(amenity.coord)
        const el = marker.getElement()
        updatePinAttractivity(el, amenity.attractivity)
      }
    }
  }, [gridAttractors, isGridMode])

  // Sync measurement markers with measurement points
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current) return

    // Helper to clean up all measurement visuals
    const cleanupMeasurementVisuals = () => {
      // Remove point markers
      for (const marker of measurementMarkersRef.current.values()) {
        marker.remove()
      }
      measurementMarkersRef.current.clear()

      // Remove distance label markers
      for (const marker of distanceLabelMarkersRef.current.values()) {
        marker.remove()
      }
      distanceLabelMarkersRef.current.clear()

      // Remove network path layer
      if (map.getLayer('measurement-network-path-layer')) {
        map.removeLayer('measurement-network-path-layer')
      }
      if (map.getSource('measurement-network-path')) {
        map.removeSource('measurement-network-path')
      }

      // Remove euclidean line layer
      if (map.getLayer('measurement-euclidean-line-layer')) {
        map.removeLayer('measurement-euclidean-line-layer')
      }
      if (map.getSource('measurement-euclidean-line')) {
        map.removeSource('measurement-euclidean-line')
      }
    }

    // If measurement is not active, remove all measurement markers and lines
    if (!isMeasurementActive) {
      cleanupMeasurementVisuals()
      return
    }

    // Handle point A marker
    if (measurementPointA) {
      let markerA = measurementMarkersRef.current.get('A')
      if (!markerA) {
        const el = createMeasurementMarkerElement('A')
        markerA = new maplibregl.Marker({
          element: el,
          draggable: true,
          anchor: 'center',
        })
          .setLngLat(measurementPointA.coord)
          .addTo(map)

        markerA.on('dragend', () => {
          const lngLat = markerA!.getLngLat()
          updateMeasurementPointRef.current('A', [lngLat.lng, lngLat.lat])
        })

        measurementMarkersRef.current.set('A', markerA)
      } else {
        markerA.setLngLat(measurementPointA.coord)
      }
    } else {
      // Remove marker A if point A is null
      const markerA = measurementMarkersRef.current.get('A')
      if (markerA) {
        markerA.remove()
        measurementMarkersRef.current.delete('A')
      }
    }

    // Handle point B marker
    if (measurementPointB) {
      let markerB = measurementMarkersRef.current.get('B')
      if (!markerB) {
        const el = createMeasurementMarkerElement('B')
        markerB = new maplibregl.Marker({
          element: el,
          draggable: true,
          anchor: 'center',
        })
          .setLngLat(measurementPointB.coord)
          .addTo(map)

        markerB.on('dragend', () => {
          const lngLat = markerB!.getLngLat()
          updateMeasurementPointRef.current('B', [lngLat.lng, lngLat.lat])
        })

        measurementMarkersRef.current.set('B', markerB)
      } else {
        markerB.setLngLat(measurementPointB.coord)
      }
    } else {
      // Remove marker B if point B is null
      const markerB = measurementMarkersRef.current.get('B')
      if (markerB) {
        markerB.remove()
        measurementMarkersRef.current.delete('B')
      }
    }

    // Update path layers and distance labels when both points are placed
    if (measurementPointA && measurementPointB) {
      // Calculate euclidean distance
      const euclideanDist = calculateEuclideanDistance(measurementPointA.coord, measurementPointB.coord)

      // --- Network path layer (solid purple line) ---
      if (networkPath && networkPath.length >= 2) {
        const networkPathData: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: networkPath
            }
          }]
        }

        if (map.getSource('measurement-network-path')) {
          (map.getSource('measurement-network-path') as maplibregl.GeoJSONSource).setData(networkPathData)
        } else {
          map.addSource('measurement-network-path', {
            type: 'geojson',
            data: networkPathData
          })
          map.addLayer({
            id: 'measurement-network-path-layer',
            type: 'line',
            source: 'measurement-network-path',
            paint: {
              'line-color': ACCENT_COLOR,
              'line-width': 5,
              'line-opacity': 1
            }
          })
        }

        // Network distance label at path midpoint
        const networkMidpoint = getPathMidpoint(networkPath)
        const networkDistStr = formatDistance(networkDistance)
        let networkLabel = distanceLabelMarkersRef.current.get('network')
        if (!networkLabel) {
          const el = createDistanceLabelElement(networkDistStr, ACCENT_COLOR, 'white', 10)
          networkLabel = new maplibregl.Marker({
            element: el,
            anchor: 'center',
          })
            .setLngLat(networkMidpoint)
            .addTo(map)
          distanceLabelMarkersRef.current.set('network', networkLabel)
        } else {
          networkLabel.setLngLat(networkMidpoint)
          updateDistanceLabelElement(networkLabel.getElement(), networkDistStr)
        }
      } else {
        // No network path available - remove it
        if (map.getLayer('measurement-network-path-layer')) {
          map.removeLayer('measurement-network-path-layer')
        }
        if (map.getSource('measurement-network-path')) {
          map.removeSource('measurement-network-path')
        }
        // Update network label to show N/A
        let networkLabel = distanceLabelMarkersRef.current.get('network')
        const eucMidpoint = getLineMidpoint(measurementPointA.coord, measurementPointB.coord)
        // Position slightly above the euclidean midpoint
        const networkLabelPos: [number, number] = [eucMidpoint[0], eucMidpoint[1] + 0.0003]
        if (!networkLabel) {
          const el = createDistanceLabelElement('N/A', ACCENT_COLOR, 'white', 10)
          networkLabel = new maplibregl.Marker({
            element: el,
            anchor: 'center',
          })
            .setLngLat(networkLabelPos)
            .addTo(map)
          distanceLabelMarkersRef.current.set('network', networkLabel)
        } else {
          networkLabel.setLngLat(networkLabelPos)
          updateDistanceLabelElement(networkLabel.getElement(), 'N/A')
        }
      }

      // --- Euclidean line layer (dashed purple line) ---
      const euclideanLineData: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [measurementPointA.coord, measurementPointB.coord]
          }
        }]
      }

      if (map.getSource('measurement-euclidean-line')) {
        (map.getSource('measurement-euclidean-line') as maplibregl.GeoJSONSource).setData(euclideanLineData)
      } else {
        map.addSource('measurement-euclidean-line', {
          type: 'geojson',
          data: euclideanLineData
        })
        map.addLayer({
          id: 'measurement-euclidean-line-layer',
          type: 'line',
          source: 'measurement-euclidean-line',
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': ACCENT_COLOR_2,
            'line-width': 5,
            'line-opacity': 0.7,
            'line-dasharray': [1, 2.5]
          }
        })
      }

      // Euclidean distance label at line midpoint
      const euclideanMidpoint = getLineMidpoint(measurementPointA.coord, measurementPointB.coord)
      const euclideanDistStr = formatDistance(euclideanDist)
      let euclideanLabel = distanceLabelMarkersRef.current.get('euclidean')
      if (!euclideanLabel) {
        const el = createDistanceLabelElement(euclideanDistStr, ACCENT_COLOR_2, 'black', 5)
        euclideanLabel = new maplibregl.Marker({
          element: el,
          anchor: 'center',
        })
          .setLngLat(euclideanMidpoint)
          .addTo(map)
        distanceLabelMarkersRef.current.set('euclidean', euclideanLabel)
      } else {
        euclideanLabel.setLngLat(euclideanMidpoint)
        updateDistanceLabelElement(euclideanLabel.getElement(), euclideanDistStr)
      }
    } else {
      // Remove lines and labels if both points are not placed
      if (map.getLayer('measurement-network-path-layer')) {
        map.removeLayer('measurement-network-path-layer')
      }
      if (map.getSource('measurement-network-path')) {
        map.removeSource('measurement-network-path')
      }
      if (map.getLayer('measurement-euclidean-line-layer')) {
        map.removeLayer('measurement-euclidean-line-layer')
      }
      if (map.getSource('measurement-euclidean-line')) {
        map.removeSource('measurement-euclidean-line')
      }
      // Remove distance labels
      for (const marker of distanceLabelMarkersRef.current.values()) {
        marker.remove()
      }
      distanceLabelMarkersRef.current.clear()
    }
  }, [isMeasurementActive, measurementPointA, measurementPointB, networkPath, networkDistance])

  // Update cursor when measurement mode changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current) return

    const canvas = map.getCanvas()
    if (isMeasurementActive) {
      canvas.style.cursor = 'crosshair'
    } else if (isGridMode) {
      canvas.style.cursor = 'crosshair'
    } else if (isCustomMode) {
      canvas.style.cursor = 'crosshair'
    } else {
      canvas.style.cursor = ''
    }
  }, [isMeasurementActive, isCustomMode, isGridMode])

  // Reduce building/grid opacity when measurement is active
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current) return

    const opacity = isMeasurementActive ? 0.3 : 1

    // Update building layers opacity
    if (map.getLayer('buildings-fill')) {
      map.setPaintProperty('buildings-fill', 'fill-extrusion-opacity', opacity)
    }

    // Update hexagon layers opacity
    if (map.getLayer('hexagons-fill')) {
      map.setPaintProperty('hexagons-fill', 'fill-opacity', opacity)
    }
  }, [isMeasurementActive])

  // Exit measurement mode on Escape key
  useEffect(() => {
    if (!isMeasurementActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMeasurementActive(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMeasurementActive, setMeasurementActive])

  return (
    <div ref={containerRef} className="absolute inset-0" />
  )
}
