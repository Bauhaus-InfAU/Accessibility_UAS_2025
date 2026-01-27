import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import type { Building, ControlPoint, CurveMode, CurveTabMode, AttractivityMode, DistanceMatrix, LandUse, StreetGraph, CustomPin, AnalysisMode, GridAttractor, HexCell, StreetsGeoJSON } from '../config/types'
import { MAX_DISTANCE_DEFAULT, DEFAULT_POLYLINE_POINTS, DEFAULT_BEZIER_HANDLES, DEFAULT_NEG_EXP_ALPHA, DEFAULT_EXP_POWER_B, DEFAULT_EXP_POWER_C } from '../config/constants'
import { loadBuildingsGeoJSON, loadStreetsGeoJSON } from '../data/dataLoader'
import { processBuildings, getBuildingsWithLandUse, getAvailableLandUses } from '../data/buildingStore'
import { buildStreetGraph, mapBuildingsToNodes, serializeGraph, findNearestNode } from '../data/streetGraph'
import { generateHexagonGrid, getVisibleHexCells } from '../data/hexagonGrid'
import { computeDistanceMatrix, computeFullNetworkMatrix } from '../computation/distanceMatrix'
import { calculateAccessibility, calculateAccessibilityFromPins, normalizeScores } from '../computation/accessibilityCalc'
import { calculateGridAccessibility, normalizeGridScores, getGridScoreRange } from '../computation/gridAccessibilityCalc'
import { createCurveEvaluatorForMode } from '../computation/curveEvaluator'

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

  // Grid mode state
  hexCells: HexCell[]
  gridAttractors: GridAttractor[]
  fullNetworkMatrix: DistanceMatrix | null
  isComputingFullMatrix: boolean
  gridAccessibilityScores: Map<string, number>
  gridRawAccessibilityScores: Map<string, number>
  gridMinRawScore: number
  gridMaxRawScore: number

  // Results (for buildings mode)
  accessibilityScores: Map<string, number>
  rawAccessibilityScores: Map<string, number>
  minRawScore: number
  maxRawScore: number
}

interface AppContextValue extends AppState {
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
  const [streetsGeoJSON, setStreetsGeoJSON] = useState<StreetsGeoJSON | null>(null)

  // Analysis mode
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('buildings')

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
  const [customPins, setCustomPins] = useState<CustomPin[]>([])

  // Grid mode state
  const [hexCells, setHexCells] = useState<HexCell[]>([])
  const [gridAttractors, setGridAttractors] = useState<GridAttractor[]>([])
  const [fullNetworkMatrix, setFullNetworkMatrix] = useState<DistanceMatrix | null>(null)
  const [isComputingFullMatrix, setIsComputingFullMatrix] = useState(false)
  const [gridAccessibilityScores, setGridAccessibilityScores] = useState<Map<string, number>>(new Map())
  const [gridRawAccessibilityScores, setGridRawAccessibilityScores] = useState<Map<string, number>>(new Map())
  const [gridMinRawScore, setGridMinRawScore] = useState(0)
  const [gridMaxRawScore, setGridMaxRawScore] = useState(0)

  // Recalculation refs to debounce
  const recalcTimeoutRef = useRef<number | null>(null)
  const gridRecalcTimeoutRef = useRef<number | null>(null)

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

        setLoadingStatus('Computing shortest paths...')
        setLoadingProgress(45)
        const serialized = serializeGraph(streetGraph)
        const matrix = await computeDistanceMatrix(
          serialized,
          processedBuildings,
          (percent) => {
            setLoadingProgress(45 + Math.floor(percent * 0.4))
            setLoadingStatus(`Computing shortest paths... ${percent}%`)
          }
        )

        setLoadingStatus('Generating hexagon grid...')
        setLoadingProgress(85)
        const generatedHexCells = generateHexagonGrid(streetGraph, loadedStreetsGeoJSON, (percent) => {
          setLoadingProgress(85 + Math.floor(percent * 0.1))
        })
        const visibleCells = getVisibleHexCells(generatedHexCells)

        setLoadingStatus('Ready!')
        setLoadingProgress(100)

        const available = getAvailableLandUses(processedBuildings)
        setBuildings(processedBuildings)
        setGraph(streetGraph)
        setDistanceMatrix(matrix)
        setAvailableLandUses(available)
        setHexCells(visibleCells)

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

  // Recalculate accessibility when inputs change
  const recalculate = useCallback(() => {
    if (!distanceMatrix || buildings.length === 0) return

    const residentialBuildings = buildings.filter(b => b.isResidential)

    // Helper to compute min/max and update state
    const processScores = (rawScores: Map<string, number>) => {
      if (rawScores.size === 0) {
        setMinRawScore(0)
        setMaxRawScore(0)
        setRawAccessibilityScores(new Map())
        setAccessibilityScores(new Map())
        return
      }
      const values = Array.from(rawScores.values())
      setMinRawScore(Math.min(...values))
      setMaxRawScore(Math.max(...values))
      setRawAccessibilityScores(new Map(rawScores))
      setAccessibilityScores(normalizeScores(rawScores))
    }

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

  // Compute full network matrix when switching to grid mode (lazy loading)
  useEffect(() => {
    if (isLoading || analysisMode !== 'grid' || fullNetworkMatrix || isComputingFullMatrix || !graph) return

    const computeMatrix = async () => {
      setIsComputingFullMatrix(true)
      setLoadingStatus('Computing full network distances...')
      try {
        const serialized = serializeGraph(graph)
        const matrix = await computeFullNetworkMatrix(serialized, (percent) => {
          setLoadingStatus(`Computing full network distances... ${percent}%`)
        })
        setFullNetworkMatrix(matrix)
        setLoadingStatus('')
      } catch (error) {
        console.error('Full network matrix computation failed:', error)
        setLoadingStatus('Error computing distances')
      } finally {
        setIsComputingFullMatrix(false)
      }
    }

    computeMatrix()
  }, [isLoading, analysisMode, fullNetworkMatrix, isComputingFullMatrix, graph])

  // Grid mode recalculation
  const recalculateGrid = useCallback(() => {
    if (!fullNetworkMatrix || hexCells.length === 0) return

    // Helper to compute min/max and update state
    const processGridScores = (rawScores: Map<string, number>) => {
      if (rawScores.size === 0) {
        setGridMinRawScore(0)
        setGridMaxRawScore(0)
        setGridRawAccessibilityScores(new Map())
        setGridAccessibilityScores(new Map())
        return
      }
      const { min, max } = getGridScoreRange(rawScores)
      setGridMinRawScore(min)
      setGridMaxRawScore(max)
      setGridRawAccessibilityScores(new Map(rawScores))
      setGridAccessibilityScores(normalizeGridScores(rawScores))
    }

    if (gridAttractors.length === 0) {
      processGridScores(new Map())
      return
    }

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

    const rawScores = calculateGridAccessibility(
      hexCells,
      gridAttractors,
      fullNetworkMatrix,
      evaluator
    )
    processGridScores(rawScores)
  }, [hexCells, gridAttractors, fullNetworkMatrix, curveTabMode, customCurveType, polylinePoints, bezierHandles, maxDistance, negExpAlpha, expPowerB, expPowerC])

  // Debounced recalculation for grid mode
  useEffect(() => {
    if (isLoading || analysisMode !== 'grid' || !fullNetworkMatrix) return

    if (gridRecalcTimeoutRef.current !== null) {
      cancelAnimationFrame(gridRecalcTimeoutRef.current)
    }
    gridRecalcTimeoutRef.current = requestAnimationFrame(() => {
      recalculateGrid()
    })

    return () => {
      if (gridRecalcTimeoutRef.current !== null) {
        cancelAnimationFrame(gridRecalcTimeoutRef.current)
      }
    }
  }, [isLoading, analysisMode, fullNetworkMatrix, recalculateGrid])

  const value: AppContextValue = {
    isLoading,
    loadingStatus,
    loadingProgress,
    buildings,
    graph,
    distanceMatrix,
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
    hexCells,
    gridAttractors,
    fullNetworkMatrix,
    isComputingFullMatrix,
    gridAccessibilityScores,
    gridRawAccessibilityScores,
    gridMinRawScore,
    gridMaxRawScore,
    accessibilityScores,
    rawAccessibilityScores,
    minRawScore,
    maxRawScore,
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
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
