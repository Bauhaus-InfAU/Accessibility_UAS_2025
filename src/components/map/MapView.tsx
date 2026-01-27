import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import { useAppContext } from '../../context/AppContext'
import { useMapContext } from '../../context/MapContext'
import { createMap } from '../../visualization/mapLibreSetup'
import { updateBuildingColors } from '../../visualization/buildingColorUpdater'

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

// SVG for custom pin marker
function createPinElement(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'custom-pin'
  el.innerHTML = `
    <svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z" fill="#fcdb02" stroke="#000" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="4" fill="#000"/>
    </svg>
  `
  return el
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapLoadedRef = useRef(false)
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
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
    removeCustomPin,
  } = useAppContext()
  const { setMapInstance, setInitialBounds } = useMapContext()

  const isCustomMode = selectedLandUse === 'Custom'

  // Memoized color update function
  const updateColors = useCallback(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current || buildings.length === 0) return
    if (map.getSource('buildings')) {
      updateBuildingColors(map, buildings, accessibilityScores, selectedLandUse)
    }
  }, [buildings, accessibilityScores, selectedLandUse])

  // Ref to always access latest updateColors in onLoad handler
  const updateColorsRef = useRef(updateColors)
  updateColorsRef.current = updateColors

  // Refs for event handlers
  const addCustomPinRef = useRef(addCustomPin)
  const updateCustomPinRef = useRef(updateCustomPin)
  const removeCustomPinRef = useRef(removeCustomPin)
  const isCustomModeRef = useRef(isCustomMode)
  const rawAccessibilityScoresRef = useRef(rawAccessibilityScores)
  const accessibilityScoresRef = useRef(accessibilityScores)

  addCustomPinRef.current = addCustomPin
  updateCustomPinRef.current = updateCustomPin
  removeCustomPinRef.current = removeCustomPin
  isCustomModeRef.current = isCustomMode
  rawAccessibilityScoresRef.current = rawAccessibilityScores
  accessibilityScoresRef.current = accessibilityScores

  // Initialize map (only depends on isLoading and buildings)
  useEffect(() => {
    if (isLoading || !containerRef.current || buildings.length === 0) return
    if (mapRef.current) return // already initialized

    const map = createMap(containerRef.current, buildings)
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
        map.getCanvas().style.cursor = isCustomModeRef.current ? 'crosshair' : ''
      })
    }

    // Handle map click for adding pins
    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (!isCustomModeRef.current) return
      const { lng, lat } = e.lngLat
      addCustomPinRef.current([lng, lat])
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
  }, [isLoading, buildings, setMapInstance, setInitialBounds])

  // Update building colors when scores or settings change
  useEffect(() => {
    updateColors()
  }, [updateColors])

  // Update cursor when Custom mode is active
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current) return

    const canvas = map.getCanvas()
    if (isCustomMode) {
      canvas.style.cursor = 'crosshair'
    } else {
      canvas.style.cursor = ''
    }
  }, [isCustomMode])

  // Sync markers with customPins (only show when in Custom mode)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current) return

    // If not in Custom mode, remove all markers
    if (!isCustomMode) {
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
        // Create new marker
        const el = createPinElement()
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

        // Prevent click from propagating to map (prevents adding new pin when clicking existing)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
        })

        markersRef.current.set(pin.id, marker)
      } else {
        // Update existing marker position
        marker.setLngLat(pin.coord)
      }
    }
  }, [customPins, isCustomMode])

  return (
    <div ref={containerRef} className="absolute inset-0" />
  )
}
