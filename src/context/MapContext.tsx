import { createContext, useContext, useRef, useCallback, type ReactNode } from 'react'
import type maplibregl from 'maplibre-gl'

interface MapContextValue {
  setMapInstance: (map: maplibregl.Map | null) => void
  zoomIn: () => void
  zoomOut: () => void
  setTopView: () => void
  setPerspective: () => void
  resetView: () => void
}

const MapContext = createContext<MapContextValue | null>(null)

// Initial bounds for Weimar city center
const INITIAL_BOUNDS: [[number, number], [number, number]] = [
  [11.315, 50.968],
  [11.345, 50.988]
]

export function useMapContext(): MapContextValue {
  const ctx = useContext(MapContext)
  if (!ctx) throw new Error('useMapContext must be used within MapProvider')
  return ctx
}

export function MapProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef<maplibregl.Map | null>(null)

  const setMapInstance = useCallback((map: maplibregl.Map | null) => {
    mapRef.current = map
  }, [])

  const zoomIn = useCallback(() => {
    mapRef.current?.zoomIn({ duration: 300 })
  }, [])

  const zoomOut = useCallback(() => {
    mapRef.current?.zoomOut({ duration: 300 })
  }, [])

  const setTopView = useCallback(() => {
    mapRef.current?.easeTo({
      pitch: 0,
      bearing: 0,
      duration: 500
    })
  }, [])

  const setPerspective = useCallback(() => {
    mapRef.current?.easeTo({
      pitch: 45,
      duration: 500
    })
  }, [])

  const resetView = useCallback(() => {
    const map = mapRef.current
    if (!map) return

    map.fitBounds(INITIAL_BOUNDS, {
      padding: 20,
      pitch: 45,
      bearing: -10,
      duration: 800
    })
  }, [])

  const value: MapContextValue = {
    setMapInstance,
    zoomIn,
    zoomOut,
    setTopView,
    setPerspective,
    resetView
  }

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>
}
