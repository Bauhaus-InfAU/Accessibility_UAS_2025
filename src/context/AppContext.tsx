import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react'
import type { Building, ControlPoint, CurveMode, CurveTabMode, AttractivityMode, DistanceMatrix, LandUse, StreetGraph, CustomPin, AnalysisMode, GridAttractor, StreetsGeoJSON, MeasurementPoint } from '../config/types'
import { MAX_DISTANCE_DEFAULT, DEFAULT_POLYLINE_POINTS, DEFAULT_BEZIER_HANDLES, DEFAULT_NEG_EXP_ALPHA, DEFAULT_EXP_POWER_B, DEFAULT_EXP_POWER_C } from '../config/constants'
import { loadBuildingsGeoJSON, loadStreetsGeoJSON } from '../data/dataLoader'
import { processBuildings, getBuildingsWithLandUse, getAvailableLandUses } from '../data/buildingStore'
import { buildStreetGraph, mapBuildingsToNodes, serializeGraph, findNearestNode } from '../data/streetGraph'
import { computeDistanceMatrix, computeFullNetworkMatrix } from '../computation/distanceMatrix'
import { calculateAccessibility, calculateAccessibilityFromPins, normalizeScores } from '../computation/accessibilityCalc'
import { findShortestPath } from '../computation/measurementCalc'

interface AppState {
  // Loading
  isLoading: boolean
  loadingStatus: string
  loadingProgress: number

  // UI State
  isPanelCollapsed: boolean

  // Data
  buildings: Building[]
  graph: StreetGraph | null
  distanceMatrix: DistanceMatrix | null
  fullNetworkMatrix: DistanceMatrix | null  // Full network matrix for terrain (all nodes to all nodes)
  isComputingFullMatrix: boolean  // Loading indicator for full network matrix computation
  availableLandUses: LandUse[]
  streetsGeoJSON: StreetsGeoJSON | null

  // Analysis mode
  analysisMode: AnalysisMode

  // User controls
  curveTabMode: CurveTabMode
  customCurveType: CurveMode
  polylinePoints: ControlPoint[]
  bezierHandles: [[number, number], [number, number]]
  maxDistance: number
  selectedLandUse: LandUse
  attractivityMode: AttractivityMode

  // Mathematical function coefficients
  negExpAlpha: number
  expPowerB: number
  expPowerC: number

  // Custom pins (for buildings mode)
  customPins: CustomPin[]
  totalCustomPinAttractivity: number

  // Grid mode state
  gridAttractors: GridAttractor[]
  terrainMinScore: number
  terrainMaxScore: number
  terrainAvgScore: number
  totalGridAttractivity: number

  // Results (for buildings mode)
  accessibilityScores: Map<string, number>
  rawAccessibilityScores: Map<string, number>
  minRawScore: number
  maxRawScore: number
  avgRawScore: number

  // Measurement tool state
  isMeasurementActive: boolean
  measurementPointA: MeasurementPoint | null
  measurementPointB: MeasurementPoint | null
  networkPath: [number, number][] | null
  networkDistance: number | null
}

interface AppContextValue extends AppState {
  setIsPanelCollapsed: (collapsed: boolean) => void
  setCurveTabMode: (mode: CurveTabMode) => void
  setCustomCurveType: (type: CurveMode) => void
  setPolylinePoints: (points: ControlPoint[]) => void
  setBezierHandles: (handles: [[number, number], [number, number]]) => void
  setSelectedLandUse: (landUse: LandUse) => void
  setAttractivityMode: (mode: AttractivityMode) => void
  setNegExpAlpha: (alpha: number) => void
  setExpPowerB: (b: number) => void
  setExpPowerC: (c: number) => void
  addCustomPin: (coord: [number, number]) => void
  updateCustomPin: (id: string, coord: [number, number]) => void
  updateCustomPinAttractivity: (id: string, attractivity: number) => void
  removeCustomPin: (id: string) => void
  clearCustomPins: () => void
  // Grid mode actions
  setAnalysisMode: (mode: AnalysisMode) => void
  addGridAttractor: (coord: [number, number]) => void
  updateGridAttractor: (id: string, coord: [number, number]) => void
  updateGridAttractorAttractivity: (id: string, attractivity: number) => void
  removeGridAttractor: (id: string) => void
  clearGridAttractors: () => void
  setTerrainStats: (stats: { min: number; max: number; avg: number }) => void
  // Measurement tool actions
  setMeasurementActive: (active: boolean) => void
  addMeasurementPoint: (coord: [number, number]) => void
  updateMeasurementPoint: (id: 'A' | 'B', coord: [number, number]) => void
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

  // UI State
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)

  const [buildings, setBuildings] = useState<Building[]>([])
  const [graph, setGraph] = useState<StreetGraph | null>(null)
  const [distanceMatrix, setDistanceMatrix] = useState<DistanceMatrix | null>(null)
  const [fullNetworkMatrix, setFullNetworkMatrix] = useState<DistanceMatrix | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isComputingFullMatrix, _setIsComputingFullMatrix] = useState(false)
  const [availableLandUses, setAvailableLandUses] = useState<LandUse[]>([])
  const [streetsGeoJSON, setStreetsGeoJSON] = useState<StreetsGeoJSON | null>(null)

  // Analysis mode - default to 'grid' for development/testing
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('grid')

  const [curveTabMode, setCurveTabMode] = useState<CurveTabMode>('custom')
  const [customCurveType, setCustomCurveType] = useState<CurveMode>('polyline')
  const [polylinePoints, setPolylinePoints] = useState<ControlPoint[]>([...DEFAULT_POLYLINE_POINTS])
  const [bezierHandles, setBezierHandles] = useState<[[number, number], [number, number]]>([...DEFAULT_BEZIER_HANDLES])
  const maxDistance = MAX_DISTANCE_DEFAULT
  const [selectedLandUse, setSelectedLandUse] = useState<LandUse>('Generic Retail')
  const [attractivityMode, setAttractivityMode] = useState<AttractivityMode>('floorArea')

  // Mathematical function coefficients
  const [negExpAlpha, setNegExpAlpha] = useState(DEFAULT_NEG_EXP_ALPHA)
  const [expPowerB, setExpPowerB] = useState(DEFAULT_EXP_POWER_B)
  const [expPowerC, setExpPowerC] = useState(DEFAULT_EXP_POWER_C)

  const [accessibilityScores, setAccessibilityScores] = useState<Map<string, number>>(new Map())
  const [rawAccessibilityScores, setRawAccessibilityScores] = useState<Map<string, number>>(new Map())
  const [minRawScore, setMinRawScore] = useState(0)
  const [maxRawScore, setMaxRawScore] = useState(0)
  const [avgRawScore, setAvgRawScore] = useState(0)
  const [customPins, setCustomPins] = useState<CustomPin[]>([])

  // Grid mode state - terrain stats (calculated by terrain layer)
  const [gridAttractors, setGridAttractors] = useState<GridAttractor[]>([])
  const [terrainMinScore, setTerrainMinScore] = useState(0)
  const [terrainMaxScore, setTerrainMaxScore] = useState(0)
  const [terrainAvgScore, setTerrainAvgScore] = useState(0)

  // Measurement tool state
  const [isMeasurementActive, setIsMeasurementActive] = useState(false)
  const [measurementPointA, setMeasurementPointA] = useState<MeasurementPoint | null>(null)
  const [measurementPointB, setMeasurementPointB] = useState<MeasurementPoint | null>(null)
  const [networkPath, setNetworkPath] = useState<[number, number][] | null>(null)
  const [networkDistance, setNetworkDistance] = useState<number | null>(null)

  // Recalculation refs to debounce
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
        const loadedStreetsGeoJSON = await loadStreetsGeoJSON()
        setStreetsGeoJSON(loadedStreetsGeoJSON)

        setLoadingStatus('Processing buildings...')
        setLoadingProgress(25)
        const processedBuildings = processBuildings(buildingsGeoJSON)

        setLoadingStatus('Building street graph...')
        setLoadingProgress(35)
        const streetGraph = buildStreetGraph(loadedStreetsGeoJSON)

        setLoadingStatus('Mapping buildings to network...')
        setLoadingProgress(40)
        mapBuildingsToNodes(processedBuildings, streetGraph)

        setLoadingStatus('Computing shortest paths (buildings)...')
        setLoadingProgress(40)
        const serialized = serializeGraph(streetGraph)
        const matrix = await computeDistanceMatrix(
          serialized,
          processedBuildings,
          (percent) => {
            setLoadingProgress(40 + Math.floor(percent * 0.25))
            setLoadingStatus(`Computing shortest paths (buildings)... ${percent}%`)
          }
        )

        setLoadingStatus('Computing full network matrix (terrain)...')
        setLoadingProgress(65)
        const fullMatrix = await computeFullNetworkMatrix(
          serialized,
          (percent) => {
            setLoadingProgress(65 + Math.floor(percent * 0.30))
            setLoadingStatus(`Computing full network matrix (terrain)... ${percent}%`)
          }
        )

        setLoadingStatus('Ready!')
        setLoadingProgress(100)

        const available = getAvailableLandUses(processedBuildings)
        setBuildings(processedBuildings)
        setGraph(streetGraph)
        setDistanceMatrix(matrix)
        setFullNetworkMatrix(fullMatrix)
        setAvailableLandUses(available)

        // Set initial land use to first available
        if (available.length > 0 && !available.includes(selectedLandUse)) {
          setSelectedLandUse(available[0])
        }

        // Create default amenities for Grid mode (2 amenities near center)
        const defaultAttractorCoords: [number, number][] = [
          [0.006, 0.022],  // slightly left of center
          [0.010, 0.018],  // slightly right and below center
        ]
        const defaultAttractors: GridAttractor[] = defaultAttractorCoords.map((coord, i) => ({
          id: `amenity-default-${i}`,
          coord,
          nearestNodeId: findNearestNode(streetGraph, coord),
          attractivity: 1,
        }))
        setGridAttractors(defaultAttractors)

        // Create default custom pins for Buildings mode (2 pins near center)
        const defaultPinCoords: [number, number][] = [
          [0.007, 0.021],  // near center
          [0.009, 0.019],  // slightly offset
        ]
        const defaultPins: CustomPin[] = defaultPinCoords.map((coord, i) => ({
          id: `pin-default-${i}`,
          coord,
          nearestNodeId: findNearestNode(streetGraph, coord),
          attractivity: 1,
        }))
        setCustomPins(defaultPins)

        setIsLoading(false)
      } catch (error) {
        console.error('Initialization failed:', error)
        setLoadingStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    init()
  }, [])

  // Custom pin actions
  const addCustomPin = useCallback((coord: [number, number]) => {
    if (!graph) return
    const nearestNodeId = findNearestNode(graph, coord)
    const newPin: CustomPin = {
      id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      coord,
      nearestNodeId,
      attractivity: 1,
    }
    setCustomPins(prev => [...prev, newPin])
  }, [graph])

  const updateCustomPin = useCallback((id: string, coord: [number, number]) => {
    if (!graph) return
    const nearestNodeId = findNearestNode(graph, coord)
    setCustomPins(prev => prev.map(pin =>
      pin.id === id ? { ...pin, coord, nearestNodeId } : pin
    ))
  }, [graph])

  const updateCustomPinAttractivity = useCallback((id: string, attractivity: number) => {
    setCustomPins(prev => prev.map(pin =>
      pin.id === id ? { ...pin, attractivity: Math.max(0, attractivity) } : pin
    ))
  }, [])

  const removeCustomPin = useCallback((id: string) => {
    setCustomPins(prev => prev.filter(pin => pin.id !== id))
  }, [])

  const clearCustomPins = useCallback(() => {
    setCustomPins([])
  }, [])

  // Grid attractor (amenity) actions
  const addGridAttractor = useCallback((coord: [number, number]) => {
    if (!graph) return
    const nearestNodeId = findNearestNode(graph, coord)
    const newAttractor: GridAttractor = {
      id: `amenity-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      coord,
      nearestNodeId,
      attractivity: 1,
    }
    setGridAttractors(prev => [...prev, newAttractor])
  }, [graph])

  const updateGridAttractor = useCallback((id: string, coord: [number, number]) => {
    if (!graph) return
    const nearestNodeId = findNearestNode(graph, coord)
    setGridAttractors(prev => prev.map(attractor =>
      attractor.id === id ? { ...attractor, coord, nearestNodeId } : attractor
    ))
  }, [graph])

  const updateGridAttractorAttractivity = useCallback((id: string, attractivity: number) => {
    setGridAttractors(prev => prev.map(attractor =>
      attractor.id === id ? { ...attractor, attractivity: Math.max(0, attractivity) } : attractor
    ))
  }, [])

  const removeGridAttractor = useCallback((id: string) => {
    setGridAttractors(prev => prev.filter(attractor => attractor.id !== id))
  }, [])

  const clearGridAttractors = useCallback(() => {
    setGridAttractors([])
  }, [])

  // Terrain stats setter (called by MapView when terrain updates)
  const setTerrainStats = useCallback((stats: { min: number; max: number; avg: number }) => {
    setTerrainMinScore(stats.min)
    setTerrainMaxScore(stats.max)
    setTerrainAvgScore(stats.avg)
  }, [])

  // Measurement tool actions
  const setMeasurementActive = useCallback((active: boolean) => {
    setIsMeasurementActive(active)
    if (!active) {
      // Clear points and path when deactivating
      setMeasurementPointA(null)
      setMeasurementPointB(null)
      setNetworkPath(null)
      setNetworkDistance(null)
    }
  }, [])

  const addMeasurementPoint = useCallback((coord: [number, number]) => {
    if (!graph) return

    const nearestNodeId = findNearestNode(graph, coord)

    // If both points exist, clear and start new measurement with point A
    if (measurementPointA && measurementPointB) {
      setMeasurementPointA({ id: 'A', coord, nearestNodeId })
      setMeasurementPointB(null)
      setNetworkPath(null)
      setNetworkDistance(null)
      return
    }

    // If no point A, set point A
    if (!measurementPointA) {
      setMeasurementPointA({ id: 'A', coord, nearestNodeId })
      return
    }

    // If point A exists but no point B, set point B
    const newPointB: MeasurementPoint = { id: 'B', coord, nearestNodeId }
    setMeasurementPointB(newPointB)

    // Compute network path
    const pathResult = findShortestPath(graph, measurementPointA, newPointB)
    if (pathResult) {
      setNetworkPath(pathResult.coordinates)
      setNetworkDistance(pathResult.distance)
    } else {
      setNetworkPath(null)
      setNetworkDistance(null)
    }
  }, [graph, measurementPointA, measurementPointB])

  const updateMeasurementPoint = useCallback((id: 'A' | 'B', coord: [number, number]) => {
    if (!graph) return
    const nearestNodeId = findNearestNode(graph, coord)

    let newPointA = measurementPointA
    let newPointB = measurementPointB

    if (id === 'A') {
      newPointA = { id: 'A', coord, nearestNodeId }
      setMeasurementPointA(newPointA)
    } else {
      newPointB = { id: 'B', coord, nearestNodeId }
      setMeasurementPointB(newPointB)
    }

    // Recompute network path if both points exist
    if (newPointA && newPointB) {
      const pathResult = findShortestPath(graph, newPointA, newPointB)
      if (pathResult) {
        setNetworkPath(pathResult.coordinates)
        setNetworkDistance(pathResult.distance)
      } else {
        setNetworkPath(null)
        setNetworkDistance(null)
      }
    }
  }, [graph, measurementPointA, measurementPointB])


  // Recalculate accessibility when inputs change (buildings mode only)
  const recalculate = useCallback(() => {
    if (!distanceMatrix || buildings.length === 0) return

    const residentialBuildings = buildings.filter(b => b.isResidential)

    // Helper to compute min/max/avg and update state
    const processScores = (rawScores: Map<string, number>) => {
      if (rawScores.size === 0) {
        setMinRawScore(0)
        setMaxRawScore(0)
        setAvgRawScore(0)
        setRawAccessibilityScores(new Map())
        setAccessibilityScores(new Map())
        return
      }
      const values = Array.from(rawScores.values())
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length
      setMinRawScore(Math.min(...values))
      setMaxRawScore(Math.max(...values))
      setAvgRawScore(avg)
      setRawAccessibilityScores(new Map(rawScores))
      setAccessibilityScores(normalizeScores(rawScores))
    }

    // Import curve evaluator dynamically to avoid circular deps
    import('../computation/curveEvaluator').then(({ createCurveEvaluatorForMode }) => {
      // Create evaluator based on current curve mode
      const evaluator = createCurveEvaluatorForMode(
        curveTabMode,
        customCurveType,
        polylinePoints,
        bezierHandles,
        maxDistance,
        negExpAlpha,
        expPowerB,
        expPowerC
      )

      // Handle Custom mode with pins
      if (selectedLandUse === 'Custom') {
        if (customPins.length === 0) {
          processScores(new Map())
          return
        }
        const rawScores = calculateAccessibilityFromPins(
          residentialBuildings,
          customPins,
          distanceMatrix,
          evaluator
        )
        processScores(rawScores)
        return
      }

      // Handle regular amenity types
      const amenityBuildings = getBuildingsWithLandUse(buildings, selectedLandUse)

      if (amenityBuildings.length === 0) {
        processScores(new Map())
        return
      }

      const rawScores = calculateAccessibility(
        residentialBuildings,
        amenityBuildings,
        selectedLandUse,
        distanceMatrix,
        evaluator,
        attractivityMode
      )
      processScores(rawScores)
    })
  }, [buildings, distanceMatrix, curveTabMode, customCurveType, polylinePoints, bezierHandles, maxDistance, selectedLandUse, attractivityMode, customPins, negExpAlpha, expPowerB, expPowerC])

  // Debounced recalculation for buildings mode
  useEffect(() => {
    if (isLoading || analysisMode !== 'buildings') return

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
  }, [isLoading, recalculate, analysisMode])

  // Computed totals for attractivity
  const totalGridAttractivity = useMemo(() =>
    gridAttractors.reduce((sum, a) => sum + (a.attractivity ?? 1), 0),
    [gridAttractors]
  )

  const totalCustomPinAttractivity = useMemo(() =>
    customPins.reduce((sum, p) => sum + (p.attractivity ?? 1), 0),
    [customPins]
  )

  const value: AppContextValue = {
    isLoading,
    loadingStatus,
    loadingProgress,
    isPanelCollapsed,
    buildings,
    graph,
    distanceMatrix,
    fullNetworkMatrix,
    isComputingFullMatrix,
    availableLandUses,
    streetsGeoJSON,
    analysisMode,
    curveTabMode,
    customCurveType,
    polylinePoints,
    bezierHandles,
    maxDistance,
    selectedLandUse,
    attractivityMode,
    negExpAlpha,
    expPowerB,
    expPowerC,
    customPins,
    totalCustomPinAttractivity,
    gridAttractors,
    terrainMinScore,
    terrainMaxScore,
    terrainAvgScore,
    totalGridAttractivity,
    accessibilityScores,
    rawAccessibilityScores,
    minRawScore,
    maxRawScore,
    avgRawScore,
    setIsPanelCollapsed,
    setCurveTabMode,
    setCustomCurveType,
    setPolylinePoints,
    setBezierHandles,
    setSelectedLandUse,
    setAttractivityMode,
    setNegExpAlpha,
    setExpPowerB,
    setExpPowerC,
    addCustomPin,
    updateCustomPin,
    updateCustomPinAttractivity,
    removeCustomPin,
    clearCustomPins,
    setAnalysisMode,
    addGridAttractor,
    updateGridAttractor,
    updateGridAttractorAttractivity,
    removeGridAttractor,
    clearGridAttractors,
    setTerrainStats,
    // Measurement tool
    isMeasurementActive,
    measurementPointA,
    measurementPointB,
    networkPath,
    networkDistance,
    setMeasurementActive,
    addMeasurementPoint,
    updateMeasurementPoint,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
