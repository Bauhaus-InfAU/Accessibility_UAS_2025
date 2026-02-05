import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react'
import type { Building, ControlPoint, CurveMode, CurveTabMode, AttractivityMode, DistanceMatrix, LandUse, StreetGraph, AnalysisMode, GridAttractor, StreetsGeoJSON, MeasurementPoint, HexCell, BuildingFilterMode } from '../config/types'
import { MAX_DISTANCE_DEFAULT, DEFAULT_POLYLINE_POINTS, DEFAULT_BEZIER_HANDLES, DEFAULT_NEG_EXP_ALPHA, DEFAULT_EXP_POWER_B, DEFAULT_EXP_POWER_C, HEX_DIAMETER_DEFAULT, TERRAIN_SMOOTH_DEFAULT, TERRAIN_HEIGHT_DEFAULT } from '../config/constants'
import { loadBuildingsGeoJSON, loadStreetsGeoJSON } from '../data/dataLoader'
import { processBuildings, getBuildingsWithLandUse, getAvailableLandUses } from '../data/buildingStore'
import { buildStreetGraph, mapBuildingsToNodes, serializeGraph, findNearestNode } from '../data/streetGraph'
import { computeDistanceMatrix, computeFullNetworkMatrix } from '../computation/distanceMatrix'
import { calculateAccessibility, calculateAccessibilityFromPins, normalizeScores } from '../computation/accessibilityCalc'
import { findShortestPath } from '../computation/measurementCalc'
import { generateHexagonGrid } from '../data/hexagonGrid'

interface AppState {
  // Loading
  isLoading: boolean
  loadingStatus: string
  loadingProgress: number

  // UI State
  isPanelCollapsed: boolean
  panelHeight: number | null  // Custom panel height in pixels (null = auto/default)
  isHelpTipVisible: boolean   // Whether the help tip is shown

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
  buildingFilterMode: BuildingFilterMode

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

  // Grid mode state (hexagon grid)
  hexCells: HexCell[]
  hexDiameter: number               // Current hexagon diameter in meters
  isRegeneratingGrid: boolean       // Loading state during grid regeneration
  gridAttractors: GridAttractor[]
  gridMinScore: number
  gridMaxScore: number
  gridAvgScore: number
  totalGridAttractivity: number

  // Surface mode state (3D terrain)
  surfaceMinScore: number
  surfaceMaxScore: number
  surfaceAvgScore: number
  terrainSmoothing: number      // Gaussian blur sigma for terrain smoothing (0-2)
  terrainHeightScale: number    // Max terrain height in meters (0-300)

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
  setPanelHeight: (height: number | null) => void
  setIsHelpTipVisible: (visible: boolean) => void
  setCurveTabMode: (mode: CurveTabMode) => void
  setCustomCurveType: (type: CurveMode) => void
  setPolylinePoints: (points: ControlPoint[]) => void
  setBezierHandles: (handles: [[number, number], [number, number]]) => void
  setSelectedLandUse: (landUse: LandUse) => void
  setAttractivityMode: (mode: AttractivityMode) => void
  setNegExpAlpha: (alpha: number) => void
  setExpPowerB: (b: number) => void
  setExpPowerC: (c: number) => void
  setBuildingFilterMode: (mode: BuildingFilterMode) => void
  // Shared attractor actions (used by all modes)
  setAnalysisMode: (mode: AnalysisMode) => void
  addGridAttractor: (coord: [number, number]) => void
  updateGridAttractor: (id: string, coord: [number, number]) => void
  updateGridAttractorAttractivity: (id: string, attractivity: number) => void
  removeGridAttractor: (id: string) => void
  clearGridAttractors: () => void
  setGridStats: (stats: { min: number; max: number; avg: number }) => void
  setSurfaceStats: (stats: { min: number; max: number; avg: number }) => void
  setHexDiameter: (diameter: number) => void
  setTerrainSmoothing: (value: number) => void
  setTerrainHeightScale: (value: number) => void
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
  const [panelHeight, setPanelHeight] = useState<number | null>(null)
  const [isHelpTipVisible, setIsHelpTipVisible] = useState(true) // Show by default

  const [buildings, setBuildings] = useState<Building[]>([])
  const [graph, setGraph] = useState<StreetGraph | null>(null)
  const [distanceMatrix, setDistanceMatrix] = useState<DistanceMatrix | null>(null)
  const [fullNetworkMatrix, setFullNetworkMatrix] = useState<DistanceMatrix | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isComputingFullMatrix, _setIsComputingFullMatrix] = useState(false)
  const [availableLandUses, setAvailableLandUses] = useState<LandUse[]>([])
  const [streetsGeoJSON, setStreetsGeoJSON] = useState<StreetsGeoJSON | null>(null)

  // Analysis mode - default to 'buildings' with custom pins
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('buildings')
  const [buildingFilterMode, setBuildingFilterMode] = useState<BuildingFilterMode>('all')

  const [curveTabMode, setCurveTabMode] = useState<CurveTabMode>('custom')
  const [customCurveType, setCustomCurveType] = useState<CurveMode>('polyline')
  const [polylinePoints, setPolylinePoints] = useState<ControlPoint[]>([...DEFAULT_POLYLINE_POINTS])
  const [bezierHandles, setBezierHandles] = useState<[[number, number], [number, number]]>([...DEFAULT_BEZIER_HANDLES])
  const maxDistance = MAX_DISTANCE_DEFAULT
  const [selectedLandUse, setSelectedLandUse] = useState<LandUse>('Custom')
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

  // Hexagon grid state
  const [hexCells, setHexCells] = useState<HexCell[]>([])
  const [hexDiameter, setHexDiameterState] = useState(HEX_DIAMETER_DEFAULT)
  const [isRegeneratingGrid, setIsRegeneratingGrid] = useState(false)

  // Shared attractors (used by Grid, Surface, and Buildings+Custom modes)
  const [gridAttractors, setGridAttractors] = useState<GridAttractor[]>([])

  // Grid mode stats (hexagon accessibility)
  const [gridMinScore, setGridMinScore] = useState(0)
  const [gridMaxScore, setGridMaxScore] = useState(0)
  const [gridAvgScore, setGridAvgScore] = useState(0)

  // Surface mode stats (3D terrain accessibility)
  const [surfaceMinScore, setSurfaceMinScore] = useState(0)
  const [surfaceMaxScore, setSurfaceMaxScore] = useState(0)
  const [surfaceAvgScore, setSurfaceAvgScore] = useState(0)

  // Terrain slider values
  const [terrainSmoothing, setTerrainSmoothing] = useState(TERRAIN_SMOOTH_DEFAULT)
  const [terrainHeightScale, setTerrainHeightScale] = useState(TERRAIN_HEIGHT_DEFAULT)

  // Measurement tool state
  const [isMeasurementActive, setIsMeasurementActive] = useState(false)
  const [measurementPointA, setMeasurementPointA] = useState<MeasurementPoint | null>(null)
  const [measurementPointB, setMeasurementPointB] = useState<MeasurementPoint | null>(null)
  const [networkPath, setNetworkPath] = useState<[number, number][] | null>(null)
  const [networkDistance, setNetworkDistance] = useState<number | null>(null)

  // Recalculation refs to debounce
  const recalcTimeoutRef = useRef<number | null>(null)
  const hexRegenTimeoutRef = useRef<number | null>(null)

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

        // Set initial land use to first available (but don't override 'Custom' which is always valid)
        if (available.length > 0 && selectedLandUse !== 'Custom' && !available.includes(selectedLandUse)) {
          setSelectedLandUse(available[0])
        }

        // Generate hexagon grid for Grid mode
        setLoadingStatus('Generating hexagon grid...')
        setLoadingProgress(96)
        const hexGrid = generateHexagonGrid(streetGraph)
        setHexCells(hexGrid)

        // Create default attractors (shared across all modes: Grid, Surface, and Buildings+Custom)
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

        setIsLoading(false)
      } catch (error) {
        console.error('Initialization failed:', error)
        setLoadingStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    init()
  }, [])

  // Shared attractor actions (used by all modes: Grid, Surface, and Buildings+Custom)
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

  // Grid stats setter (called by MapView when hexagon grid updates)
  const setGridStats = useCallback((stats: { min: number; max: number; avg: number }) => {
    setGridMinScore(stats.min)
    setGridMaxScore(stats.max)
    setGridAvgScore(stats.avg)
  }, [])

  // Surface stats setter (called by MapView when terrain updates)
  const setSurfaceStats = useCallback((stats: { min: number; max: number; avg: number }) => {
    setSurfaceMinScore(stats.min)
    setSurfaceMaxScore(stats.max)
    setSurfaceAvgScore(stats.avg)
  }, [])

  // Hexagon diameter setter with debounced grid regeneration
  const setHexDiameter = useCallback((diameter: number) => {
    setHexDiameterState(diameter)

    // Clear any pending regeneration
    if (hexRegenTimeoutRef.current !== null) {
      clearTimeout(hexRegenTimeoutRef.current)
    }

    // Debounce grid regeneration by 400ms
    hexRegenTimeoutRef.current = window.setTimeout(() => {
      if (!graph) return

      setIsRegeneratingGrid(true)

      // Use requestAnimationFrame to allow UI to update before heavy computation
      requestAnimationFrame(() => {
        const newHexCells = generateHexagonGrid(graph, diameter)
        setHexCells(newHexCells)
        setIsRegeneratingGrid(false)
      })
    }, 400)
  }, [graph])

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
    // For "All Buildings" mode, we need the full network matrix since distanceMatrix
    // only has entries for residential buildings
    if (buildingFilterMode === 'all' && !fullNetworkMatrix) return

    // Choose the appropriate distance matrix based on filter mode
    const activeMatrix = buildingFilterMode === 'all' ? fullNetworkMatrix! : distanceMatrix

    // Determine which buildings to analyze based on filter mode
    let targetBuildings: Building[]
    if (buildingFilterMode === 'residential') {
      targetBuildings = buildings.filter(b => b.isResidential)
    } else {
      // All buildings mode
      if (selectedLandUse === 'Custom') {
        // Custom mode: all buildings (custom pins aren't buildings)
        targetBuildings = buildings
      } else {
        // Predefined amenity: exclude buildings that ARE the selected amenity
        targetBuildings = buildings.filter(b => !((b.landUseAreas[selectedLandUse] || 0) > 0))
      }
    }

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

      // Handle Custom mode with shared attractors
      if (selectedLandUse === 'Custom') {
        if (gridAttractors.length === 0) {
          processScores(new Map())
          return
        }
        const rawScores = calculateAccessibilityFromPins(
          targetBuildings,
          gridAttractors,
          activeMatrix,
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
        targetBuildings,
        amenityBuildings,
        selectedLandUse,
        activeMatrix,
        evaluator,
        attractivityMode
      )
      processScores(rawScores)
    })
  }, [buildings, distanceMatrix, fullNetworkMatrix, curveTabMode, customCurveType, polylinePoints, bezierHandles, maxDistance, selectedLandUse, attractivityMode, gridAttractors, negExpAlpha, expPowerB, expPowerC, buildingFilterMode])

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


  const value: AppContextValue = {
    isLoading,
    loadingStatus,
    loadingProgress,
    isPanelCollapsed,
    panelHeight,
    isHelpTipVisible,
    buildings,
    graph,
    distanceMatrix,
    fullNetworkMatrix,
    isComputingFullMatrix,
    availableLandUses,
    streetsGeoJSON,
    analysisMode,
    buildingFilterMode,
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
    hexCells,
    hexDiameter,
    isRegeneratingGrid,
    gridAttractors,
    gridMinScore,
    gridMaxScore,
    gridAvgScore,
    totalGridAttractivity,
    surfaceMinScore,
    surfaceMaxScore,
    surfaceAvgScore,
    terrainSmoothing,
    terrainHeightScale,
    accessibilityScores,
    rawAccessibilityScores,
    minRawScore,
    maxRawScore,
    avgRawScore,
    setIsPanelCollapsed,
    setPanelHeight,
    setIsHelpTipVisible,
    setCurveTabMode,
    setCustomCurveType,
    setPolylinePoints,
    setBezierHandles,
    setSelectedLandUse,
    setAttractivityMode,
    setNegExpAlpha,
    setExpPowerB,
    setExpPowerC,
    setBuildingFilterMode,
    setAnalysisMode,
    addGridAttractor,
    updateGridAttractor,
    updateGridAttractorAttractivity,
    removeGridAttractor,
    clearGridAttractors,
    setGridStats,
    setSurfaceStats,
    setHexDiameter,
    setTerrainSmoothing,
    setTerrainHeightScale,
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
