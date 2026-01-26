import { useEffect, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import { useAppContext } from '../../context/AppContext'
import { createMap } from '../../visualization/mapLibreSetup'
import { updateBuildingColors } from '../../visualization/buildingColorUpdater'

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const { buildings, accessibilityScores, isLoading, selectedLandUse, showAmenityPreview } = useAppContext()

  // Initialize map
  useEffect(() => {
    if (isLoading || !containerRef.current || buildings.length === 0) return
    if (mapRef.current) return // already initialized

    const map = createMap(containerRef.current, buildings)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [isLoading, buildings])

  // Update building colors when scores or amenity preview settings change
  useEffect(() => {
    const map = mapRef.current
    if (!map || buildings.length === 0) return

    const updateColors = () => {
      if (map.isStyleLoaded() && map.getSource('buildings')) {
        updateBuildingColors(map, buildings, accessibilityScores, selectedLandUse, showAmenityPreview)
      }
    }

    // If style is already loaded, update immediately
    if (map.isStyleLoaded() && map.getSource('buildings')) {
      updateColors()
    } else {
      // Otherwise wait for load
      map.on('load', updateColors)
    }
  }, [buildings, accessibilityScores, selectedLandUse, showAmenityPreview])

  return (
    <div ref={containerRef} className="flex-1 relative" />
  )
}
