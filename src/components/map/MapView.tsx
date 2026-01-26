import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import { useAppContext } from '../../context/AppContext'
import { createMap } from '../../visualization/mapLibreSetup'
import { updateBuildingColors } from '../../visualization/buildingColorUpdater'

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
  const {
    buildings,
    accessibilityScores,
    isLoading,
    selectedLandUse,
    customPins,
    addCustomPin,
    updateCustomPin,
    removeCustomPin,
  } = useAppContext()

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

  addCustomPinRef.current = addCustomPin
  updateCustomPinRef.current = updateCustomPin
  removeCustomPinRef.current = removeCustomPin
  isCustomModeRef.current = isCustomMode

  // Initialize map (only depends on isLoading and buildings)
  useEffect(() => {
    if (isLoading || !containerRef.current || buildings.length === 0) return
    if (mapRef.current) return // already initialized

    const map = createMap(containerRef.current, buildings)
    mapRef.current = map
    mapLoadedRef.current = false

    const onLoad = () => {
      mapLoadedRef.current = true
      // Use ref to get latest updateColors
      updateColorsRef.current()
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
      map.remove()
      mapRef.current = null
      mapLoadedRef.current = false
    }
  }, [isLoading, buildings])

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
    <div ref={containerRef} className="flex-1 relative" />
  )
}
