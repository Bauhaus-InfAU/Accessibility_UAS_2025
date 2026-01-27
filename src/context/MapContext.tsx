import { createContext, useContext, useRef, useCallback, useState, type ReactNode } from 'react'
import type maplibregl from 'maplibre-gl'

type ViewMode = 'top' | 'perspective'

interface MapContextValue {
  setMapInstance: (map: maplibregl.Map | null) => void
  setInitialBounds: (bounds: [[number, number], [number, number]]) => void
  zoomIn: () => void
  zoomOut: () => void
  setTopView: () => void
  setPerspective: () => void
  resetView: () => void
  activeView: ViewMode
}

const MapContext = createContext<MapContextValue | null>(null)

export function useMapContext(): MapContextValue {
  const ctx = useContext(MapContext)
  if (!ctx) throw new Error('useMapContext must be used within MapProvider')
  return ctx
}

export function MapProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const initialBoundsRef = useRef<[[number, number], [number, number]] | null>(null)
  const [activeView, setActiveView] = useState<ViewMode>('perspective')

  const setMapInstance = useCallback((map: maplibregl.Map | null) => {
    mapRef.current = map
  }, [])

  const setInitialBounds = useCallback((bounds: [[number, number], [number, number]]) => {
    initialBoundsRef.current = bounds
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
    setActiveView('top')
  }, [])

  const setPerspective = useCallback(() => {
    mapRef.current?.easeTo({
      pitch: 55,
      duration: 500
    })
    setActiveView('perspective')
  }, [])

  const resetView = useCallback(() => {
    const map = mapRef.current
    const bounds = initialBoundsRef.current
    if (!map || !bounds) return

    map.fitBounds(bounds, {
      padding: 50,
      pitch: 55,
      bearing: -17,
      duration: 800
    })
    setActiveView('perspective')
  }, [])

  const value: MapContextValue = {
    setMapInstance,
    setInitialBounds,
    zoomIn,
    zoomOut,
    setTopView,
    setPerspective,
    resetView,
    activeView
  }

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>
}
