import { useEffect, useRef, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import { useAppContext } from '../../context/AppContext'
import { createMap } from '../../visualization/mapLibreSetup'
import { updateBuildingColors } from '../../visualization/buildingColorUpdater'

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapLoadedRef = useRef(false)
  const { buildings, accessibilityScores, isLoading, selectedLandUse } = useAppContext()

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

    map.on('load', onLoad)

    return () => {
      map.off('load', onLoad)
      map.remove()
      mapRef.current = null
      mapLoadedRef.current = false
    }
  }, [isLoading, buildings])

  // Update building colors when scores or settings change
  useEffect(() => {
    updateColors()
  }, [updateColors])

  return (
    <div ref={containerRef} className="flex-1 relative" />
  )
}
