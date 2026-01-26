import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import type { Building, ControlPoint, CurveMode, AttractivityMode, DistanceMatrix, LandUse, StreetGraph } from '../config/types'
import { MAX_DISTANCE_DEFAULT, DEFAULT_POLYLINE_POINTS, DEFAULT_BEZIER_HANDLES } from '../config/constants'
import { loadBuildingsGeoJSON, loadStreetsGeoJSON } from '../data/dataLoader'
import { processBuildings, getBuildingsWithLandUse, getAvailableLandUses } from '../data/buildingStore'
import { buildStreetGraph, mapBuildingsToNodes, serializeGraph } from '../data/streetGraph'
import { computeDistanceMatrix } from '../computation/distanceMatrix'
import { calculateAccessibility, normalizeScores } from '../computation/accessibilityCalc'
import { createCurveEvaluator } from '../computation/curveEvaluator'

interface AppState {
  // Loading
  isLoading: boolean
  loadingStatus: string
  loadingProgress: number

  // Data
  buildings: Building[]
  graph: StreetGraph | null
  distanceMatrix: DistanceMatrix | null
  availableLandUses: LandUse[]

  // User controls
  curveMode: CurveMode
  polylinePoints: ControlPoint[]
  bezierHandles: [[number, number], [number, number]]
  maxDistance: number
  selectedLandUse: LandUse
  attractivityMode: AttractivityMode

  // Results
  accessibilityScores: Map<string, number>
}

interface AppContextValue extends AppState {
  setCurveMode: (mode: CurveMode) => void
  setPolylinePoints: (points: ControlPoint[]) => void
  setBezierHandles: (handles: [[number, number], [number, number]]) => void
  setSelectedLandUse: (landUse: LandUse) => void
  setAttractivityMode: (mode: AttractivityMode) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState('Initializing...')
  const [loadingProgress, setLoadingProgress] = useState(0)

  const [buildings, setBuildings] = useState<Building[]>([])
  const [graph, setGraph] = useState<StreetGraph | null>(null)
  const [distanceMatrix, setDistanceMatrix] = useState<DistanceMatrix | null>(null)
  const [availableLandUses, setAvailableLandUses] = useState<LandUse[]>([])

  const [curveMode, setCurveMode] = useState<CurveMode>('polyline')
  const [polylinePoints, setPolylinePoints] = useState<ControlPoint[]>([...DEFAULT_POLYLINE_POINTS])
  const [bezierHandles, setBezierHandles] = useState<[[number, number], [number, number]]>([...DEFAULT_BEZIER_HANDLES])
  const maxDistance = MAX_DISTANCE_DEFAULT
  const [selectedLandUse, setSelectedLandUse] = useState<LandUse>('Generic Retail')
  const [attractivityMode, setAttractivityMode] = useState<AttractivityMode>('floorArea')

  const [accessibilityScores, setAccessibilityScores] = useState<Map<string, number>>(new Map())

  // Recalculation ref to debounce
  const recalcTimeoutRef = useRef<number | null>(null)

  // Startup: load data and precompute distances
  useEffect(() => {
    async function init() {
      try {
        setLoadingStatus('Loading building data...')
        setLoadingProgress(5)
        const buildingsGeoJSON = await loadBuildingsGeoJSON()

        setLoadingStatus('Loading street network...')
        setLoadingProgress(15)
        const streetsGeoJSON = await loadStreetsGeoJSON()

        setLoadingStatus('Processing buildings...')
        setLoadingProgress(25)
        const processedBuildings = processBuildings(buildingsGeoJSON)

        setLoadingStatus('Building street graph...')
        setLoadingProgress(35)
        const streetGraph = buildStreetGraph(streetsGeoJSON)

        setLoadingStatus('Mapping buildings to network...')
        setLoadingProgress(40)
        mapBuildingsToNodes(processedBuildings, streetGraph)

        setLoadingStatus('Computing shortest paths...')
        setLoadingProgress(45)
        const serialized = serializeGraph(streetGraph)
        const matrix = await computeDistanceMatrix(
          serialized,
          processedBuildings,
          (percent) => {
            setLoadingProgress(45 + Math.floor(percent * 0.5))
            setLoadingStatus(`Computing shortest paths... ${percent}%`)
          }
        )

        setLoadingStatus('Ready!')
        setLoadingProgress(100)

        const available = getAvailableLandUses(processedBuildings)
        setBuildings(processedBuildings)
        setGraph(streetGraph)
        setDistanceMatrix(matrix)
        setAvailableLandUses(available)

        // Set initial land use to first available
        if (available.length > 0 && !available.includes(selectedLandUse)) {
          setSelectedLandUse(available[0])
        }

        setIsLoading(false)
      } catch (error) {
        console.error('Initialization failed:', error)
        setLoadingStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    init()
  }, [])

  // Recalculate accessibility when inputs change
  const recalculate = useCallback(() => {
    if (!distanceMatrix || buildings.length === 0) return

    const residentialBuildings = buildings.filter(b => b.isResidential)
    const amenityBuildings = getBuildingsWithLandUse(buildings, selectedLandUse)

    if (amenityBuildings.length === 0) {
      setAccessibilityScores(new Map())
      return
    }

    const evaluator = createCurveEvaluator(curveMode, polylinePoints, bezierHandles, maxDistance)
    const rawScores = calculateAccessibility(
      residentialBuildings,
      amenityBuildings,
      selectedLandUse,
      distanceMatrix,
      evaluator,
      attractivityMode
    )
    const normalized = normalizeScores(rawScores)
    setAccessibilityScores(normalized)
  }, [buildings, distanceMatrix, curveMode, polylinePoints, bezierHandles, maxDistance, selectedLandUse, attractivityMode])

  // Debounced recalculation
  useEffect(() => {
    if (isLoading) return

    if (recalcTimeoutRef.current !== null) {
      cancelAnimationFrame(recalcTimeoutRef.current)
    }
    recalcTimeoutRef.current = requestAnimationFrame(() => {
      recalculate()
    })

    return () => {
      if (recalcTimeoutRef.current !== null) {
        cancelAnimationFrame(recalcTimeoutRef.current)
      }
    }
  }, [isLoading, recalculate])

  const value: AppContextValue = {
    isLoading,
    loadingStatus,
    loadingProgress,
    buildings,
    graph,
    distanceMatrix,
    availableLandUses,
    curveMode,
    polylinePoints,
    bezierHandles,
    maxDistance,
    selectedLandUse,
    attractivityMode,
    accessibilityScores,
    setCurveMode,
    setPolylinePoints,
    setBezierHandles,
    setSelectedLandUse,
    setAttractivityMode,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
