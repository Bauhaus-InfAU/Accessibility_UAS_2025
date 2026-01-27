import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import type { Building, ControlPoint, CurveMode, CurveTabMode, AttractivityMode, DistanceMatrix, LandUse, StreetGraph, CustomPin } from '../config/types'
import { MAX_DISTANCE_DEFAULT, DEFAULT_POLYLINE_POINTS, DEFAULT_BEZIER_HANDLES, DEFAULT_NEG_EXP_ALPHA, DEFAULT_EXP_POWER_B, DEFAULT_EXP_POWER_C } from '../config/constants'
import { loadBuildingsGeoJSON, loadStreetsGeoJSON } from '../data/dataLoader'
import { processBuildings, getBuildingsWithLandUse, getAvailableLandUses } from '../data/buildingStore'
import { buildStreetGraph, mapBuildingsToNodes, serializeGraph, findNearestNode } from '../data/streetGraph'
import { computeDistanceMatrix } from '../computation/distanceMatrix'
import { calculateAccessibility, calculateAccessibilityFromPins, normalizeScores } from '../computation/accessibilityCalc'
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

  // Custom pins
  customPins: CustomPin[]

  // Results
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
  removeCustomPin: (id: string) => void
  clearCustomPins: () => void
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

  // Custom pin actions
  const addCustomPin = useCallback((coord: [number, number]) => {
    if (!graph) return
    const nearestNodeId = findNearestNode(graph, coord)
    const newPin: CustomPin = {
      id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      coord,
      nearestNodeId,
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

  const removeCustomPin = useCallback((id: string) => {
    setCustomPins(prev => prev.filter(pin => pin.id !== id))
  }, [])

  const clearCustomPins = useCallback(() => {
    setCustomPins([])
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
    removeCustomPin,
    clearCustomPins,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
