import { useEffect, useRef, useCallback, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { useAppContext } from '../../context/AppContext'
import { useMapContext } from '../../context/MapContext'
import { createMap, setStreetLayersVisibility } from '../../visualization/mapLibreSetup'
import { updateBuildingColors, setBuildingLayersVisibility, applyBuildingFilterOpacity, resetBuildingFilterOpacity } from '../../visualization/buildingColorUpdater'
import { updateHexagonColors, setHexagonLayersVisibility, applyHexagonFilterOpacity, resetHexagonFilterOpacity } from '../../visualization/hexagonColorUpdater'
import { calculateGridAccessibility, normalizeGridScores, getGridScoreStats } from '../../computation/gridAccessibilityCalc'
import { updateTerrainLayer, setTerrainLayerVisibility, isTerrainLayerInitialized, updateAttractorPins, createPinOverlayContainer, removePinOverlayContainer, getAttractorPinScreenPositions, setTerrainMeshOpacity, setTerrainStreetNetworkVisibility, setTerrainFilterRange, raycastTerrainScore, hasTerrainAttractors } from '../../visualization/threeJsLayer'
import { createCurveEvaluatorForMode } from '../../computation/curveEvaluator'
import { calculateEuclideanDistance, formatDistance, getPathMidpoint, getLineMidpoint } from '../../computation/measurementCalc'
import { computeExplorerResults } from '../../computation/explorerCalc'
import { ACCENT_COLOR, ACCENT_COLOR_2 } from '../../config/constants'

// Flag to track if attractivity editing just finished (prevents map click from adding pin)
let justFinishedEditingAttractivity = false

// Calculate color from normalized score (0-1) using the accessibility gradient
// Purple (#4A3AB4) → Orange (#FD681D) → Red (#FD1D1D)
function getScoreColor(normalizedScore: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  const t = clamp(normalizedScore)

  // Colors: purple at 0, orange at 0.5, red at 1
  const purple = { r: 0x4A, g: 0x3A, b: 0xB4 }
  const orange = { r: 0xFD, g: 0x68, b: 0x1D }
  const red = { r: 0xFD, g: 0x1D, b: 0x1D }

  let r: number, g: number, b: number
  if (t < 0.5) {
    // Interpolate purple → orange
    const t2 = t * 2
    r = Math.round(purple.r + (orange.r - purple.r) * t2)
    g = Math.round(purple.g + (orange.g - purple.g) * t2)
    b = Math.round(purple.b + (orange.b - purple.b) * t2)
  } else {
    // Interpolate orange → red
    const t2 = (t - 0.5) * 2
    r = Math.round(orange.r + (red.r - orange.r) * t2)
    g = Math.round(orange.g + (red.g - orange.g) * t2)
    b = Math.round(orange.b + (red.b - orange.b) * t2)
  }

  return `rgb(${r}, ${g}, ${b})`
}

// Get pin scale (constant size, attractivity no longer affects pin size)
function getPinScale(_attractivity: number): number {
  return 1.0
}

// Unified attractor marker element
// - showTeardrop=true: teardrop SVG above attractivity box (Grid, Buildings+Custom modes)
// - showTeardrop=false: box only (Surface mode - 3D pin rendered by HTML overlay)
function createAttractorMarkerElement(
  attractivity: number,
  index: number,
  onAttractivityChange: (newValue: number) => void,
  showTeardrop: boolean = true
): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'attractor-marker'

  const attLabel = `<span class="att-math-label">Att<sub>${index}</sub></span>&nbsp;=&nbsp;${attractivity}`

  if (showTeardrop) {
    // Teardrop in a zero-height wrapper so it doesn't affect bounding box
    el.innerHTML = `
      <div class="teardrop-wrapper">
        <div class="attractor-teardrop">
          <svg width="24" height="32" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z" fill="#fcdb02" stroke="#000" stroke-width="1.5"/>
            <circle cx="12" cy="12" r="4" fill="#000"/>
          </svg>
        </div>
      </div>
      <div class="attractivity-box" data-attractivity="${attractivity}">
        <span class="att-value">${attLabel}</span>
      </div>
    `
  } else {
    // Box only (Surface mode - 3D pin rendered separately by HTML overlay)
    el.innerHTML = `
      <div class="attractivity-box" data-attractivity="${attractivity}">
        <span class="att-value">${attLabel}</span>
      </div>
    `
  }

  const attBox = el.querySelector('.attractivity-box') as HTMLDivElement
  const attValue = attBox.querySelector('.att-value') as HTMLSpanElement

  // Handle click on attractivity box to edit
  attBox.addEventListener('click', (e) => {
    e.stopPropagation()

    // Already editing, don't create another input
    if (attBox.querySelector('input')) return

    const currentValue = parseFloat(attBox.getAttribute('data-attractivity') || '1')
    attValue.style.display = 'none'

    const input = document.createElement('input')
    input.type = 'number'
    input.className = 'att-input'
    input.value = currentValue.toString()
    input.min = '0'
    input.step = '0.1'
    attBox.appendChild(input)
    input.focus()
    input.select()

    let isFinished = false
    const finishEditing = () => {
      if (isFinished) return
      isFinished = true
      const newValue = parseFloat(input.value)
      if (!isNaN(newValue) && newValue >= 0) {
        // Preserve current label format (explorer index or generic "j")
        const currentSub = attValue.querySelector('sub')
        const sub = currentSub ? currentSub.textContent : 'j'
        attValue.innerHTML = `<span class="att-math-label">Att<sub>${sub}</sub></span>&nbsp;=&nbsp;${newValue}`
        attBox.setAttribute('data-attractivity', newValue.toString())
        onAttractivityChange(newValue)
      }
      input.remove()
      attValue.style.display = ''
      // Prevent map click from adding pin right after closing input
      justFinishedEditingAttractivity = true
      setTimeout(() => { justFinishedEditingAttractivity = false }, 100)
    }

    // Stop propagation on input clicks to prevent interference with spinner
    input.addEventListener('click', (e) => e.stopPropagation())
    input.addEventListener('mousedown', (e) => e.stopPropagation())
    input.addEventListener('mouseup', (e) => e.stopPropagation())

    input.addEventListener('blur', finishEditing)
    input.addEventListener('keydown', (ke) => {
      if (ke.key === 'Enter') {
        finishEditing()
      } else if (ke.key === 'Escape') {
        input.remove()
        attValue.style.display = ''
      }
    })
  })

  return el
}

// Update attractivity value on existing marker element
function updateAttractorMarkerAttractivity(el: HTMLElement, attractivity: number): void {
  const attValue = el.querySelector('.att-value') as HTMLSpanElement
  if (!attValue) return
  // Preserve current label format (explorer index or generic "j")
  const currentSub = attValue.querySelector('sub')
  const sub = currentSub ? currentSub.textContent : 'j'
  attValue.innerHTML = `<span class="att-math-label">Att<sub>${sub}</sub></span>&nbsp;=&nbsp;${attractivity}`
  const attBox = el.querySelector('.attractivity-box') as HTMLDivElement
  if (attBox) attBox.setAttribute('data-attractivity', attractivity.toString())
}

// Update attractor marker label with numbered subscript (e.g., "Att₁ = 1")
function updateAttractorMarkerLabel(el: HTMLElement, index: number, attractivity: number): void {
  const attValue = el.querySelector('.att-value') as HTMLSpanElement | null
  if (!attValue) return
  attValue.innerHTML = `<span class="att-math-label">Att<sub>${index}</sub></span>&nbsp;=&nbsp;${attractivity}`
}

// Update attractor marker color (teardrop fill + attractivity box background)
function updateAttractorMarkerColor(el: HTMLElement, color: string | null): void {
  const defaultColor = '#fcdb02'
  const c = color ?? defaultColor
  // Update teardrop SVG fill
  const teardropPath = el.querySelector('.attractor-teardrop path') as SVGPathElement | null
  if (teardropPath) {
    teardropPath.setAttribute('fill', c)
  }
  // Update attractivity box background
  const attBox = el.querySelector('.attractivity-box') as HTMLDivElement | null
  if (attBox) {
    attBox.style.background = c
  }
}

// Create measurement marker element (purple circle with A/B label)
function createMeasurementMarkerElement(label: 'A' | 'B'): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'measurement-marker'
  el.innerHTML = `
    <div class="measurement-marker-circle">${label}</div>
  `
  return el
}

// Create distance label element for map
function createDistanceLabelElement(distance: string, bgColor: string, textColor: string = 'white', zIndex: number = 1): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'measurement-distance-label'
  el.style.backgroundColor = bgColor
  el.style.color = textColor
  el.style.zIndex = zIndex.toString()
  el.textContent = distance
  return el
}

// Update distance label content
function updateDistanceLabelElement(el: HTMLElement, distance: string): void {
  el.textContent = distance
}

// Create explorer flag marker element (black flag on post + score box)
function createExplorerFlagElement(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'explorer-flag'
  el.innerHTML = `
    <div class="explorer-flag-icon">
      <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="5" y1="2" x2="5" y2="35" stroke="#333" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M5 2l20 7-20 7z" fill="#333" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="explorer-flag-score"></div>
  `
  return el
}

// Update the score label on the explorer flag element
function updateExplorerFlagScore(el: HTMLElement, score: number | null): void {
  const scoreEl = el.querySelector('.explorer-flag-score') as HTMLDivElement | null
  if (!scoreEl) return
  if (score !== null) {
    scoreEl.innerHTML = `<span class="explorer-flag-score-label">Acc<sub>i</sub></span>&nbsp;=&nbsp;${score.toFixed(2)}`
    scoreEl.style.display = 'flex'
  } else {
    scoreEl.innerHTML = ''
    scoreEl.style.display = 'none'
  }
}

// Create explorer distance label element
function createExplorerDistanceLabelElement(distance: string, bgColor: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'explorer-distance-label'
  el.style.backgroundColor = bgColor
  el.textContent = distance
  return el
}

// Create terrain pin SVG element (HTML overlay positioned via 3D projection)
function createTerrainPinSVGElement(attractivity: number): HTMLDivElement {
  const scale = getPinScale(attractivity)
  const width = Math.round(24 * scale)
  const height = Math.round(32 * scale)

  const el = document.createElement('div')
  el.className = 'terrain-pin-svg'
  el.style.position = 'absolute'
  el.style.pointerEvents = 'none'
  el.style.willChange = 'transform'
  el.setAttribute('data-scale', scale.toString())
  el.innerHTML = `
    <svg width="${width}" height="${height}" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20c0-6.627-5.373-12-12-12z" fill="#fcdb02" stroke="#000" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="4" fill="#000"/>
    </svg>
  `
  return el
}

// Update terrain pin SVG element size when attractivity changes
function updateTerrainPinSVGElement(el: HTMLDivElement, attractivity: number): void {
  const scale = getPinScale(attractivity)
  const width = Math.round(24 * scale)
  const height = Math.round(32 * scale)
  const svg = el.querySelector('svg')
  if (svg) {
    svg.setAttribute('width', width.toString())
    svg.setAttribute('height', height.toString())
  }
  el.setAttribute('data-scale', scale.toString())
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const mapLoadedRef = useRef(false)
  const [mapLoaded, setMapLoaded] = useState(false) // State for triggering effects
  const attractorMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const measurementMarkersRef = useRef<Map<'A' | 'B', maplibregl.Marker>>(new Map())
  const distanceLabelMarkersRef = useRef<Map<'network' | 'euclidean', maplibregl.Marker>>(new Map())
  const explorerFlagMarkerRef = useRef<maplibregl.Marker | null>(null)
  const explorerLabelMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const terrainUpdatePendingRef = useRef(false)
  // HTML pin overlay refs for terrain-aware 3D-projected pins
  const pinOverlayRef = useRef<HTMLDivElement | null>(null)
  const pinElementsRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const {
    buildings,
    graph,
    accessibilityScores,
    rawAccessibilityScores,
    isLoading,
    selectedLandUse,
    attractivityMode,
    buildingFilterMode,
    // Curve parameters for terrain
    curveTabMode,
    customCurveType,
    polylinePoints,
    bezierHandles,
    maxDistance,
    negExpAlpha,
    expPowerB,
    expPowerC,
    // Analysis mode and shared attractors
    analysisMode,
    hexCells,
    gridAttractors,
    addGridAttractor,
    updateGridAttractor,
    updateGridAttractorAttractivity,
    removeGridAttractor,
    setGridStats,
    setSurfaceStats,
    // Full network distance matrix for terrain
    fullNetworkMatrix,
    // Terrain slider parameters (Surface mode)
    terrainSmoothing,
    terrainHeightScale,
    // Surface score stats for denormalization
    surfaceMinScore,
    surfaceMaxScore,
    // Gradient range mode
    gradientRangeMode,
    fixedGradientMin,
    fixedGradientMax,
    // Filter range state
    filterRangeActive,
    filterRangeMinPercent,
    filterRangeMaxPercent,
    // Distance mode
    distanceMode,
    // Measurement tool state
    isMeasurementActive,
    measurementPointA,
    measurementPointB,
    networkPath,
    networkDistance,
    addMeasurementPoint,
    updateMeasurementPoint,
    setMeasurementActive,
    // Explorer tool state
    isExplorerActive,
    explorerLocation,
    explorerNodeId,
    explorerResults,
    explorerAmenityPreview,
    clearExplorer,
    setExplorerLocation,
    setExplorerResults,
    setHoveredExplorerId,
  } = useAppContext()
  const { setMapInstance, setInitialBounds, setBearing } = useMapContext()

  const isCustomMode = selectedLandUse === 'Custom'
  const isGridMode = analysisMode === 'grid'
  const isSurfaceMode = analysisMode === 'surface'

  // Compute filter range for color updaters
  const filterRange = filterRangeActive
    ? { minPercent: filterRangeMinPercent, maxPercent: filterRangeMaxPercent }
    : null

  // Memoized color update function for buildings
  const updateColors = useCallback(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current || buildings.length === 0) return
    if (map.getSource('buildings')) {
      updateBuildingColors(map, buildings, accessibilityScores, selectedLandUse, buildingFilterMode, filterRange)
    }
  }, [buildings, accessibilityScores, selectedLandUse, buildingFilterMode, filterRange])

  // Ref to always access latest updateColors in onLoad handler
  const updateColorsRef = useRef(updateColors)
  updateColorsRef.current = updateColors

  // Refs for event handlers
  const isCustomModeRef = useRef(isCustomMode)
  const isGridModeRef = useRef(isGridMode)
  const isSurfaceModeRef = useRef(isSurfaceMode)
  const rawAccessibilityScoresRef = useRef(rawAccessibilityScores)
  const accessibilityScoresRef = useRef(accessibilityScores)
  const addGridAttractorRef = useRef(addGridAttractor)
  const updateGridAttractorRef = useRef(updateGridAttractor)
  const updateGridAttractorAttractivityRef = useRef(updateGridAttractorAttractivity)
  const removeGridAttractorRef = useRef(removeGridAttractor)
  const buildingFilterModeRef = useRef(buildingFilterMode)
  const isMeasurementActiveRef = useRef(isMeasurementActive)
  const addMeasurementPointRef = useRef(addMeasurementPoint)
  const updateMeasurementPointRef = useRef(updateMeasurementPoint)

  buildingFilterModeRef.current = buildingFilterMode
  isCustomModeRef.current = isCustomMode
  isGridModeRef.current = isGridMode
  isSurfaceModeRef.current = isSurfaceMode
  rawAccessibilityScoresRef.current = rawAccessibilityScores
  accessibilityScoresRef.current = accessibilityScores
  addGridAttractorRef.current = addGridAttractor
  updateGridAttractorRef.current = updateGridAttractor
  updateGridAttractorAttractivityRef.current = updateGridAttractorAttractivity
  removeGridAttractorRef.current = removeGridAttractor
  isMeasurementActiveRef.current = isMeasurementActive
  addMeasurementPointRef.current = addMeasurementPoint
  updateMeasurementPointRef.current = updateMeasurementPoint

  const isExplorerActiveRef = useRef(isExplorerActive)
  const setExplorerLocationRef = useRef(setExplorerLocation)
  isExplorerActiveRef.current = isExplorerActive
  setExplorerLocationRef.current = setExplorerLocation

  // Refs for terrain hover score denormalization
  const surfaceMinScoreRef = useRef(surfaceMinScore)
  const surfaceMaxScoreRef = useRef(surfaceMaxScore)
  const gradientRangeModeRef = useRef(gradientRangeMode)
  const fixedGradientMinRef = useRef(fixedGradientMin)
  const fixedGradientMaxRef = useRef(fixedGradientMax)
  surfaceMinScoreRef.current = surfaceMinScore
  surfaceMaxScoreRef.current = surfaceMaxScore
  gradientRangeModeRef.current = gradientRangeMode
  fixedGradientMinRef.current = fixedGradientMin
  fixedGradientMaxRef.current = fixedGradientMax

  // Initialize map (only depends on isLoading and buildings)
  useEffect(() => {
    if (isLoading || !containerRef.current || buildings.length === 0) return
    if (mapRef.current) return // already initialized

    const map = createMap(containerRef.current, buildings, graph)
    mapRef.current = map
    mapLoadedRef.current = false
    setMapInstance(map)

    // Create pin overlay container for terrain-aware 3D-projected pins
    if (containerRef.current) {
      pinOverlayRef.current = createPinOverlayContainer(containerRef.current)
    }

    const onLoad = () => {
      mapLoadedRef.current = true
      setMapLoaded(true) // Trigger effects that depend on map being loaded
      // Compute and store initial bounds from buildings
      if (buildings.length > 0) {
        let minLng = Infinity, maxLng = -Infinity
        let minLat = Infinity, maxLat = -Infinity
        for (const b of buildings) {
          const [lng, lat] = b.centroid
          if (lng < minLng) minLng = lng
          if (lng > maxLng) maxLng = lng
          if (lat < minLat) minLat = lat
          if (lat > maxLat) maxLat = lat
        }
        setInitialBounds([[minLng, minLat], [maxLng, maxLat]])
      }
      // Use ref to get latest updateColors
      updateColorsRef.current()

      // Mark that we need to update terrain once initialized
      terrainUpdatePendingRef.current = true

      // Set initial layer visibility based on current mode
      if (isGridModeRef.current) {
        // Grid mode: show hexagons, hide terrain & buildings
        setHexagonLayersVisibility(map, true)
        setTerrainLayerVisibility(false)
        setBuildingLayersVisibility(map, false)
        setStreetLayersVisibility(map, true)  // Show streets with hexagons
      } else if (isSurfaceModeRef.current) {
        // Surface mode: show terrain, hide hexagons & buildings
        setHexagonLayersVisibility(map, false)
        setTerrainLayerVisibility(true)
        setBuildingLayersVisibility(map, false)
        setStreetLayersVisibility(map, false)  // 3D streets on terrain
      } else {
        // Buildings mode: show buildings, hide terrain & hexagons
        setHexagonLayersVisibility(map, false)
        setTerrainLayerVisibility(false)
        setBuildingLayersVisibility(map, true)
        setStreetLayersVisibility(map, true)
      }

      // Track bearing changes for compass indicator
      map.on('rotate', () => {
        setBearing(map.getBearing())
      })

      // Building hover handlers for score popup
      map.on('mousemove', 'buildings-fill', (e) => {
        // Skip if not in buildings mode
        if (isGridModeRef.current || isSurfaceModeRef.current) return
        // Suppress normal popup when explorer is active (ghost flag shows score instead)
        if (isExplorerActiveRef.current) return

        const feature = e.features?.[0]
        if (!feature?.properties) return

        const { id, isResidential } = feature.properties
        // Skip non-residential buildings when filter is set to residential only
        if (buildingFilterModeRef.current === 'residential' && !isResidential) {
          if (popupRef.current) {
            popupRef.current.remove()
            popupRef.current = null
          }
          map.getCanvas().style.cursor = isCustomModeRef.current ? 'crosshair' : ''
          return
        }

        const rawScore = rawAccessibilityScoresRef.current.get(id)
        const normalizedScore = accessibilityScoresRef.current.get(id)
        // Skip unscored buildings
        if (rawScore === undefined || normalizedScore === undefined) {
          if (popupRef.current) {
            popupRef.current.remove()
            popupRef.current = null
          }
          map.getCanvas().style.cursor = isCustomModeRef.current ? 'crosshair' : ''
          return
        }

        // Show pointer cursor for scored buildings
        map.getCanvas().style.cursor = 'pointer'

        // Get color matching the building's color
        const color = getScoreColor(normalizedScore)

        // Create or update popup
        if (!popupRef.current) {
          popupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: 'score-popup',
          })
        }

        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(`<div class="score-value" style="color: ${color}">${rawScore.toFixed(1)}</div>`)
          .addTo(map)
      })

      map.on('mouseleave', 'buildings-fill', () => {
        if (popupRef.current) {
          popupRef.current.remove()
          popupRef.current = null
        }
        if (!isGridModeRef.current && !isSurfaceModeRef.current) {
          map.getCanvas().style.cursor = isCustomModeRef.current ? 'crosshair' : ''
        }
      })

      // Hexagon hover handlers for score popup (Grid mode)
      map.on('mousemove', 'hexagons-fill', (e) => {
        // Skip if not in grid mode
        if (!isGridModeRef.current) return
        // Suppress normal popup when explorer is active (ghost flag shows score instead)
        if (isExplorerActiveRef.current) return

        const feature = e.features?.[0]
        if (!feature?.properties) return

        const score = feature.properties.score as number
        const rawScore = feature.properties.rawScore as number

        // Skip unscored hexagons
        if (score < 0 || rawScore < 0) {
          if (popupRef.current) {
            popupRef.current.remove()
            popupRef.current = null
          }
          map.getCanvas().style.cursor = 'crosshair'
          return
        }

        // Show pointer cursor for scored hexagons
        map.getCanvas().style.cursor = 'pointer'

        // Get color matching the hexagon's color
        const color = getScoreColor(score)

        // Create or update popup
        if (!popupRef.current) {
          popupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: 'score-popup',
          })
        }

        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(`<div class="score-value" style="color: ${color}">${rawScore.toFixed(1)}</div>`)
          .addTo(map)
      })

      map.on('mouseleave', 'hexagons-fill', () => {
        if (!isGridModeRef.current) return
        if (popupRef.current) {
          popupRef.current.remove()
          popupRef.current = null
        }
        map.getCanvas().style.cursor = 'crosshair'
      })

      // Terrain hover handler for score popup (Surface mode)
      // Uses raycast through Three.js camera to find the actual terrain surface point,
      // since MapLibre's e.lngLat projects onto the ground plane (z=0) which is wrong
      // when the terrain has elevation.
      map.on('mousemove', (e) => {
        if (!isSurfaceModeRef.current) return
        if (isMeasurementActiveRef.current) return
        // Suppress normal popup when explorer is active (ghost flag shows score instead)
        if (isExplorerActiveRef.current) return

        // No attractors placed → no scores to show
        if (!hasTerrainAttractors()) {
          if (popupRef.current) {
            popupRef.current.remove()
            popupRef.current = null
          }
          map.getCanvas().style.cursor = 'crosshair'
          return
        }

        // Raycast from screen position into terrain mesh
        const hit = raycastTerrainScore(e.point.x, e.point.y)

        // No terrain hit (cursor outside terrain bounds)
        if (!hit) {
          if (popupRef.current) {
            popupRef.current.remove()
            popupRef.current = null
          }
          map.getCanvas().style.cursor = 'crosshair'
          return
        }

        const normalizedScore = hit.score

        // Denormalize to raw score
        let rawScore: number
        if (gradientRangeModeRef.current === 'fixed') {
          rawScore = normalizedScore * (fixedGradientMaxRef.current - fixedGradientMinRef.current) + fixedGradientMinRef.current
        } else {
          rawScore = normalizedScore * (surfaceMaxScoreRef.current - surfaceMinScoreRef.current) + surfaceMinScoreRef.current
        }

        const color = getScoreColor(normalizedScore)
        map.getCanvas().style.cursor = 'pointer'

        if (!popupRef.current) {
          popupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            className: 'score-popup',
          })
        }

        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(`<div class="score-value" style="color: ${color}">${rawScore.toFixed(1)}</div>`)
          .addTo(map)
      })
    }

    // Handle map click for adding pins, attractors, or measurement points
    const onClick = (e: maplibregl.MapMouseEvent) => {
      // Ignore clicks that originated from attractivity input editing
      const target = e.originalEvent.target as HTMLElement
      if (target.closest('.attractivity-box') || target.classList.contains('att-input')) {
        return
      }

      // Ignore clicks right after closing attractivity input (prevents accidental pin creation)
      if (justFinishedEditingAttractivity) {
        return
      }

      const { lng, lat } = e.lngLat

      // Measurement mode takes priority over other click handlers
      if (isMeasurementActiveRef.current) {
        addMeasurementPointRef.current([lng, lat])
        return
      }

      // Explorer mode: place or move flag
      if (isExplorerActiveRef.current) {
        setExplorerLocationRef.current([lng, lat])
        return
      }

      // Grid mode: add attractor (shared with surface mode)
      if (isGridModeRef.current) {
        addGridAttractorRef.current([lng, lat])
        return
      }

      // Surface mode: add attractor (shared with grid mode)
      if (isSurfaceModeRef.current) {
        addGridAttractorRef.current([lng, lat])
        return
      }

      // Buildings mode with Custom: add shared attractor
      if (isCustomModeRef.current) {
        addGridAttractorRef.current([lng, lat])
      }
    }

    map.on('load', onLoad)
    map.on('click', onClick)

    return () => {
      map.off('load', onLoad)
      map.off('click', onClick)
      // Clean up attractor markers
      for (const marker of attractorMarkersRef.current.values()) {
        marker.remove()
      }
      attractorMarkersRef.current.clear()
      // Clean up measurement markers
      for (const marker of measurementMarkersRef.current.values()) {
        marker.remove()
      }
      measurementMarkersRef.current.clear()
      // Clean up distance label markers
      for (const marker of distanceLabelMarkersRef.current.values()) {
        marker.remove()
      }
      distanceLabelMarkersRef.current.clear()
      // Clean up explorer markers
      if (explorerFlagMarkerRef.current) {
        explorerFlagMarkerRef.current.remove()
        explorerFlagMarkerRef.current = null
      }
      for (const marker of explorerLabelMarkersRef.current.values()) {
        marker.remove()
      }
      explorerLabelMarkersRef.current.clear()
      // Clean up popup
      if (popupRef.current) {
        popupRef.current.remove()
        popupRef.current = null
      }
      // Clean up terrain pin overlay
      for (const el of pinElementsRef.current.values()) {
        el.remove()
      }
      pinElementsRef.current.clear()
      removePinOverlayContainer()
      pinOverlayRef.current = null

      map.remove()
      mapRef.current = null
      mapLoadedRef.current = false
      setMapInstance(null)
    }
  }, [isLoading, buildings, graph, setMapInstance, setInitialBounds])

  // Update building colors when scores or settings change
  useEffect(() => {
    updateColors()
  }, [updateColors])

  // Update filter opacity directly when filter range changes (for live updates during drag)
  // This is separate from updateColors which also updates the source data
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    if (filterRangeActive) {
      const currentFilterRange = { minPercent: filterRangeMinPercent, maxPercent: filterRangeMaxPercent }
      // Apply to buildings (in buildings mode)
      if (!isGridMode && !isSurfaceMode) {
        applyBuildingFilterOpacity(map, currentFilterRange)
      }
      // Apply to hexagons (in grid mode)
      if (isGridMode) {
        applyHexagonFilterOpacity(map, currentFilterRange)
      }
      // Apply to terrain (in surface mode) - this updates the shader for sharp boundaries
      if (isSurfaceMode) {
        setTerrainFilterRange(filterRangeMinPercent, filterRangeMaxPercent, true)
      }
    } else {
      // Reset opacity when filter is cleared
      if (!isGridMode && !isSurfaceMode) {
        resetBuildingFilterOpacity(map)
      }
      if (isGridMode) {
        resetHexagonFilterOpacity(map)
      }
      // Reset terrain filter (in surface mode)
      if (isSurfaceMode) {
        setTerrainFilterRange(0, 1, false)
      }
    }
  }, [mapLoaded, filterRangeActive, filterRangeMinPercent, filterRangeMaxPercent, isGridMode, isSurfaceMode])

  // Update hexagon grid when attractors or curve parameters change (Grid mode)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || !isGridMode || !fullNetworkMatrix || hexCells.length === 0) return

    // Create curve evaluator
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

    // Determine fixed range if in fixed mode
    const fixedRange = gradientRangeMode === 'fixed'
      ? { min: fixedGradientMin, max: fixedGradientMax }
      : undefined

    // Calculate accessibility scores for hexagon cells
    const rawScores = calculateGridAccessibility(hexCells, gridAttractors, fullNetworkMatrix, evaluator, distanceMode)
    const normalizedScores = normalizeGridScores(rawScores, fixedRange)
    const stats = getGridScoreStats(rawScores)

    // Update hexagon colors on the map (pass filter range)
    const currentFilterRange = filterRangeActive
      ? { minPercent: filterRangeMinPercent, maxPercent: filterRangeMaxPercent }
      : null
    updateHexagonColors(map, hexCells, normalizedScores, currentFilterRange, rawScores)

    // Update grid stats
    setGridStats(stats)
  }, [mapLoaded, isGridMode, hexCells, gridAttractors, curveTabMode, customCurveType, polylinePoints, bezierHandles, maxDistance, negExpAlpha, expPowerB, expPowerC, setGridStats, fullNetworkMatrix, gradientRangeMode, fixedGradientMin, fixedGradientMax, filterRangeActive, filterRangeMinPercent, filterRangeMaxPercent, distanceMode])

  // Update terrain when attractors or curve parameters change (Surface mode)
  useEffect(() => {
    if (!mapLoaded || !isSurfaceMode || !fullNetworkMatrix) return

    // Function to perform the terrain update
    const performTerrainUpdate = () => {
      // Create curve evaluator
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

      // Determine fixed range if in fixed mode
      const fixedRange = gradientRangeMode === 'fixed'
        ? { min: fixedGradientMin, max: fixedGradientMax }
        : undefined

      // Determine filter range if active
      const currentFilterRange = filterRangeActive
        ? { minPercent: filterRangeMinPercent, maxPercent: filterRangeMaxPercent }
        : null

      // Update terrain with current attractors and full network distance matrix
      const stats = updateTerrainLayer(gridAttractors, evaluator, fullNetworkMatrix, terrainSmoothing, terrainHeightScale, fixedRange, currentFilterRange, distanceMode)
      if (stats) {
        setSurfaceStats(stats)
      }
    }

    // Wait for terrain layer to be initialized using polling
    if (!isTerrainLayerInitialized()) {
      const checkInterval = setInterval(() => {
        if (isTerrainLayerInitialized()) {
          clearInterval(checkInterval)
          performTerrainUpdate()
        }
      }, 50)
      // Clean up interval on unmount or dependency change
      return () => clearInterval(checkInterval)
    }

    // Terrain is already initialized, update immediately
    performTerrainUpdate()
  }, [mapLoaded, isSurfaceMode, gridAttractors, curveTabMode, customCurveType, polylinePoints, bezierHandles, maxDistance, negExpAlpha, expPowerB, expPowerC, setSurfaceStats, fullNetworkMatrix, terrainSmoothing, terrainHeightScale, gradientRangeMode, fixedGradientMin, fixedGradientMax, filterRangeActive, filterRangeMinPercent, filterRangeMaxPercent, distanceMode])

  // Update layer visibility when analysis mode changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    // Clear terrain hover popup when leaving Surface mode
    if (!isSurfaceMode && popupRef.current) {
      popupRef.current.remove()
      popupRef.current = null
    }

    if (isGridMode) {
      // Grid mode: show hexagons, hide terrain & buildings
      setHexagonLayersVisibility(map, true)
      setTerrainLayerVisibility(false)
      setBuildingLayersVisibility(map, false)
      setStreetLayersVisibility(map, true)  // Show streets with hexagons
    } else if (isSurfaceMode) {
      // Surface mode: show terrain, hide hexagons & buildings
      setHexagonLayersVisibility(map, false)
      setTerrainLayerVisibility(true)
      setBuildingLayersVisibility(map, false)
      setStreetLayersVisibility(map, false)  // 3D streets on terrain
    } else {
      // Buildings mode: show buildings, hide terrain & hexagons
      setHexagonLayersVisibility(map, false)
      setTerrainLayerVisibility(false)
      setBuildingLayersVisibility(map, true)
      setStreetLayersVisibility(map, true)
    }
  }, [mapLoaded, isGridMode, isSurfaceMode])

  // Sync attractor markers with gridAttractors (shared across all modes: Grid, Surface, and Buildings+Custom)
  // - Grid mode: Teardrop + box (anchor: center, box centered at coordinate)
  // - Buildings+Custom mode: Teardrop + box (anchor: center, box centered at coordinate)
  // - Surface mode: Box only (anchor: center) + HTML overlay pin at terrain height
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    // Determine which modes should show attractor markers
    const isBuildingsCustomMode = !isGridMode && !isSurfaceMode && isCustomMode
    const showAttractorMarkers = isGridMode || isSurfaceMode || isBuildingsCustomMode

    // If not in a mode that shows attractors, remove all attractor markers and clear 3D pins
    if (!showAttractorMarkers) {
      for (const marker of attractorMarkersRef.current.values()) {
        marker.remove()
      }
      attractorMarkersRef.current.clear()
      // Clear 3D pins when not showing attractors
      updateAttractorPins([])
      return
    }

    // Determine marker type:
    // - Surface mode: box-only (3D teardrop rendered by HTML overlay at terrain height)
    // - Grid / Buildings+Custom: teardrop + box (2D modes, show teardrop in marker)
    const showTeardrop = !isSurfaceMode
    const markerType = showTeardrop ? 'teardrop-box' : 'box-only'

    // Check if existing markers need to be recreated due to marker type change
    const firstMarkerId = attractorMarkersRef.current.keys().next().value
    const firstMarkerEl = firstMarkerId ? attractorMarkersRef.current.get(firstMarkerId)?.getElement() : null
    const existingMarkerType = firstMarkerEl?.getAttribute('data-marker-type')

    if (existingMarkerType && existingMarkerType !== markerType) {
      // Marker type changed - remove all existing markers to recreate with new type
      for (const marker of attractorMarkersRef.current.values()) {
        marker.remove()
      }
      attractorMarkersRef.current.clear()
    }

    const existingIds = new Set(attractorMarkersRef.current.keys())
    const currentIds = new Set(gridAttractors.map(a => a.id))

    // Remove markers for deleted attractors
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        const marker = attractorMarkersRef.current.get(id)
        marker?.remove()
        attractorMarkersRef.current.delete(id)
      }
    }

    // Add or update markers for current attractors
    for (let idx = 0; idx < gridAttractors.length; idx++) {
      const attractor = gridAttractors[idx]
      let marker = attractorMarkersRef.current.get(attractor.id)

      if (!marker) {
        // Create unified marker element
        const el = createAttractorMarkerElement(
          attractor.attractivity,
          idx + 1,
          (newValue) => {
            updateGridAttractorAttractivityRef.current(attractor.id, newValue)
          },
          showTeardrop
        )

        // Mark the element with its type for mode change detection
        el.setAttribute('data-marker-type', markerType)

        // Always use 'center' anchor - box is centered at coordinate
        marker = new maplibregl.Marker({
          element: el,
          draggable: true,
          anchor: 'center',
        })
          .setLngLat(attractor.coord)
          .addTo(map)

        // Handle drag end
        marker.on('dragend', () => {
          const lngLat = marker!.getLngLat()
          updateGridAttractorRef.current(attractor.id, [lngLat.lng, lngLat.lat])
        })

        // Handle right-click to delete
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault()
          e.stopPropagation()
          removeGridAttractorRef.current(attractor.id)
        })

        // Hover handlers for explorer highlighting
        el.addEventListener('mouseenter', () => {
          setHoveredExplorerId(attractor.id)
        })
        el.addEventListener('mouseleave', () => {
          setHoveredExplorerId(null)
        })

        attractorMarkersRef.current.set(attractor.id, marker)
      } else {
        // Update existing marker position and attractivity
        marker.setLngLat(attractor.coord)
        const el = marker.getElement()
        updateAttractorMarkerAttractivity(el, attractor.attractivity)
      }
    }

    // Update all marker labels with correct sequential indices (indices shift when attractors are added/removed)
    for (let idx = 0; idx < gridAttractors.length; idx++) {
      const marker = attractorMarkersRef.current.get(gridAttractors[idx].id)
      if (marker) {
        updateAttractorMarkerLabel(marker.getElement(), idx + 1, gridAttractors[idx].attractivity)
      }
    }

    // Update 3D attractor pins (connecting lines) in the terrain layer
    // Only relevant for Surface mode, but safe to call in other modes (will just be empty)
    if (isTerrainLayerInitialized()) {
      updateAttractorPins(isSurfaceMode ? gridAttractors : [])
    } else if (isSurfaceMode) {
      // Poll for terrain layer initialization (only in Surface mode)
      const checkInterval = setInterval(() => {
        if (isTerrainLayerInitialized()) {
          clearInterval(checkInterval)
          updateAttractorPins(gridAttractors)
        }
      }, 50)
      // Clean up interval after 5 seconds max
      setTimeout(() => clearInterval(checkInterval), 5000)
    }
  }, [mapLoaded, gridAttractors, isGridMode, isSurfaceMode, isCustomMode])

  // Manage HTML pin overlay elements (positioned via 3D projection at terrain height)
  // This is separate from the MapLibre attractor markers which show the attractivity box at ground level
  // Only show in Surface mode (Grid mode uses 2D markers)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || !isSurfaceMode) {
      // Clear pin overlays when not in surface mode
      for (const el of pinElementsRef.current.values()) {
        el.remove()
      }
      pinElementsRef.current.clear()
      return
    }

    const overlay = pinOverlayRef.current
    if (!overlay) return

    // Sync pin elements with gridAttractors
    const currentIds = new Set(gridAttractors.map(a => a.id))

    // Remove deleted pins
    for (const [id, el] of pinElementsRef.current) {
      if (!currentIds.has(id)) {
        el.remove()
        pinElementsRef.current.delete(id)
      }
    }

    // Add/update pin elements
    for (const attractor of gridAttractors) {
      let el = pinElementsRef.current.get(attractor.id)
      if (!el) {
        el = createTerrainPinSVGElement(attractor.attractivity)
        overlay.appendChild(el)
        pinElementsRef.current.set(attractor.id, el)
      } else {
        // Update size if attractivity changed
        const currentScale = el.getAttribute('data-scale')
        const newScale = getPinScale(attractor.attractivity).toString()
        if (currentScale !== newScale) {
          updateTerrainPinSVGElement(el, attractor.attractivity)
        }
      }
    }

    // Subscribe to render events to update pin positions
    const updatePinPositions = () => {
      const positions = getAttractorPinScreenPositions()
      for (const [id, pos] of positions) {
        const el = pinElementsRef.current.get(id)
        if (el) {
          if (pos.visible) {
            el.style.display = 'block'
            // Get pin height for proper anchoring at bottom (tip of teardrop)
            const scale = parseFloat(el.getAttribute('data-scale') || '1')
            const pinHeight = Math.round(32 * scale)
            const pinWidth = Math.round(24 * scale)
            // Position: translate to screen coords, then offset to center horizontally and anchor at bottom
            el.style.transform = `translate(${pos.x - pinWidth / 2}px, ${pos.y - pinHeight}px)`
          } else {
            el.style.display = 'none'
          }
        }
      }
    }

    // Initial position update
    updatePinPositions()

    // Update on each render frame
    map.on('render', updatePinPositions)
    return () => {
      map.off('render', updatePinPositions)
    }
  }, [mapLoaded, isSurfaceMode, gridAttractors])

  // Sync measurement markers with measurement points
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current) return

    // Helper to clean up all measurement visuals
    const cleanupMeasurementVisuals = () => {
      // Remove point markers
      for (const marker of measurementMarkersRef.current.values()) {
        marker.remove()
      }
      measurementMarkersRef.current.clear()

      // Remove distance label markers
      for (const marker of distanceLabelMarkersRef.current.values()) {
        marker.remove()
      }
      distanceLabelMarkersRef.current.clear()

      // Remove network path layer
      if (map.getLayer('measurement-network-path-layer')) {
        map.removeLayer('measurement-network-path-layer')
      }
      if (map.getSource('measurement-network-path')) {
        map.removeSource('measurement-network-path')
      }

      // Remove euclidean line layer
      if (map.getLayer('measurement-euclidean-line-layer')) {
        map.removeLayer('measurement-euclidean-line-layer')
      }
      if (map.getSource('measurement-euclidean-line')) {
        map.removeSource('measurement-euclidean-line')
      }
    }

    // If measurement is not active, remove all measurement markers and lines
    if (!isMeasurementActive) {
      cleanupMeasurementVisuals()
      return
    }

    // Handle point A marker
    if (measurementPointA) {
      let markerA = measurementMarkersRef.current.get('A')
      if (!markerA) {
        const el = createMeasurementMarkerElement('A')
        markerA = new maplibregl.Marker({
          element: el,
          draggable: true,
          anchor: 'center',
        })
          .setLngLat(measurementPointA.coord)
          .addTo(map)

        markerA.on('dragend', () => {
          const lngLat = markerA!.getLngLat()
          updateMeasurementPointRef.current('A', [lngLat.lng, lngLat.lat])
        })

        measurementMarkersRef.current.set('A', markerA)
      } else {
        markerA.setLngLat(measurementPointA.coord)
      }
    } else {
      // Remove marker A if point A is null
      const markerA = measurementMarkersRef.current.get('A')
      if (markerA) {
        markerA.remove()
        measurementMarkersRef.current.delete('A')
      }
    }

    // Handle point B marker
    if (measurementPointB) {
      let markerB = measurementMarkersRef.current.get('B')
      if (!markerB) {
        const el = createMeasurementMarkerElement('B')
        markerB = new maplibregl.Marker({
          element: el,
          draggable: true,
          anchor: 'center',
        })
          .setLngLat(measurementPointB.coord)
          .addTo(map)

        markerB.on('dragend', () => {
          const lngLat = markerB!.getLngLat()
          updateMeasurementPointRef.current('B', [lngLat.lng, lngLat.lat])
        })

        measurementMarkersRef.current.set('B', markerB)
      } else {
        markerB.setLngLat(measurementPointB.coord)
      }
    } else {
      // Remove marker B if point B is null
      const markerB = measurementMarkersRef.current.get('B')
      if (markerB) {
        markerB.remove()
        measurementMarkersRef.current.delete('B')
      }
    }

    // Update path layers and distance labels when both points are placed
    if (measurementPointA && measurementPointB) {
      // Calculate euclidean distance
      const euclideanDist = calculateEuclideanDistance(measurementPointA.coord, measurementPointB.coord)

      // --- Network path layer (solid purple line) ---
      if (networkPath && networkPath.length >= 2) {
        const networkPathData: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: networkPath
            }
          }]
        }

        if (map.getSource('measurement-network-path')) {
          (map.getSource('measurement-network-path') as maplibregl.GeoJSONSource).setData(networkPathData)
        } else {
          map.addSource('measurement-network-path', {
            type: 'geojson',
            data: networkPathData
          })
          map.addLayer({
            id: 'measurement-network-path-layer',
            type: 'line',
            source: 'measurement-network-path',
            paint: {
              'line-color': ACCENT_COLOR,
              'line-width': 5,
              'line-opacity': 1
            }
          })
        }

        // Network distance label at path midpoint
        const networkMidpoint = getPathMidpoint(networkPath)
        const networkDistStr = formatDistance(networkDistance)
        let networkLabel = distanceLabelMarkersRef.current.get('network')
        if (!networkLabel) {
          const el = createDistanceLabelElement(networkDistStr, ACCENT_COLOR, 'white', 10)
          networkLabel = new maplibregl.Marker({
            element: el,
            anchor: 'center',
          })
            .setLngLat(networkMidpoint)
            .addTo(map)
          distanceLabelMarkersRef.current.set('network', networkLabel)
        } else {
          networkLabel.setLngLat(networkMidpoint)
          updateDistanceLabelElement(networkLabel.getElement(), networkDistStr)
        }
      } else {
        // No network path available - remove it
        if (map.getLayer('measurement-network-path-layer')) {
          map.removeLayer('measurement-network-path-layer')
        }
        if (map.getSource('measurement-network-path')) {
          map.removeSource('measurement-network-path')
        }
        // Update network label to show N/A
        let networkLabel = distanceLabelMarkersRef.current.get('network')
        const eucMidpoint = getLineMidpoint(measurementPointA.coord, measurementPointB.coord)
        // Position slightly above the euclidean midpoint
        const networkLabelPos: [number, number] = [eucMidpoint[0], eucMidpoint[1] + 0.0003]
        if (!networkLabel) {
          const el = createDistanceLabelElement('N/A', ACCENT_COLOR, 'white', 10)
          networkLabel = new maplibregl.Marker({
            element: el,
            anchor: 'center',
          })
            .setLngLat(networkLabelPos)
            .addTo(map)
          distanceLabelMarkersRef.current.set('network', networkLabel)
        } else {
          networkLabel.setLngLat(networkLabelPos)
          updateDistanceLabelElement(networkLabel.getElement(), 'N/A')
        }
      }

      // --- Euclidean line layer (dashed purple line) ---
      const euclideanLineData: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [measurementPointA.coord, measurementPointB.coord]
          }
        }]
      }

      if (map.getSource('measurement-euclidean-line')) {
        (map.getSource('measurement-euclidean-line') as maplibregl.GeoJSONSource).setData(euclideanLineData)
      } else {
        map.addSource('measurement-euclidean-line', {
          type: 'geojson',
          data: euclideanLineData
        })
        map.addLayer({
          id: 'measurement-euclidean-line-layer',
          type: 'line',
          source: 'measurement-euclidean-line',
          layout: {
            'line-cap': 'round',
            'line-join': 'round'
          },
          paint: {
            'line-color': ACCENT_COLOR_2,
            'line-width': 5,
            'line-opacity': 0.7,
            'line-dasharray': [1, 2.5]
          }
        })
      }

      // Euclidean distance label at line midpoint
      const euclideanMidpoint = getLineMidpoint(measurementPointA.coord, measurementPointB.coord)
      const euclideanDistStr = formatDistance(euclideanDist)
      let euclideanLabel = distanceLabelMarkersRef.current.get('euclidean')
      if (!euclideanLabel) {
        const el = createDistanceLabelElement(euclideanDistStr, ACCENT_COLOR_2, 'black', 5)
        euclideanLabel = new maplibregl.Marker({
          element: el,
          anchor: 'center',
        })
          .setLngLat(euclideanMidpoint)
          .addTo(map)
        distanceLabelMarkersRef.current.set('euclidean', euclideanLabel)
      } else {
        euclideanLabel.setLngLat(euclideanMidpoint)
        updateDistanceLabelElement(euclideanLabel.getElement(), euclideanDistStr)
      }
    } else {
      // Remove lines and labels if both points are not placed
      if (map.getLayer('measurement-network-path-layer')) {
        map.removeLayer('measurement-network-path-layer')
      }
      if (map.getSource('measurement-network-path')) {
        map.removeSource('measurement-network-path')
      }
      if (map.getLayer('measurement-euclidean-line-layer')) {
        map.removeLayer('measurement-euclidean-line-layer')
      }
      if (map.getSource('measurement-euclidean-line')) {
        map.removeSource('measurement-euclidean-line')
      }
      // Remove distance labels
      for (const marker of distanceLabelMarkersRef.current.values()) {
        marker.remove()
      }
      distanceLabelMarkersRef.current.clear()
    }
  }, [isMeasurementActive, measurementPointA, measurementPointB, networkPath, networkDistance])

  // Explorer tool: compute results when location or parameters change
  useEffect(() => {
    if (!isExplorerActive || !explorerLocation || !explorerNodeId || !graph || !fullNetworkMatrix) {
      return
    }

    // Create curve evaluator
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

    // Gather amenities based on current mode
    const amenities: Array<{ id: string; label: string; coord: [number, number]; nodeId: string; attractivity: number }> = []

    if (selectedLandUse === 'Custom' || isGridMode || isSurfaceMode) {
      // Use shared attractors (custom pins / grid attractors)
      for (const a of gridAttractors) {
        amenities.push({
          id: a.id,
          label: `Amenity ${amenities.length + 1}`,
          coord: a.coord,
          nodeId: a.nearestNodeId,
          attractivity: a.attractivity,
        })
      }
    } else {
      // Predefined amenity type: use amenity buildings
      const amenityBuildings = buildings.filter(b => (b.landUseAreas[selectedLandUse] || 0) > 0)
      for (const b of amenityBuildings) {
        if (!b.nearestNodeId) continue
        const area = b.landUseAreas[selectedLandUse] || 0
        let att: number
        switch (attractivityMode) {
          case 'volume': att = area * b.height; break
          case 'count': att = area > 0 ? 1 : 0; break
          default: att = area
        }
        amenities.push({
          id: b.id,
          label: `Building ${b.id.slice(0, 6)}`,
          coord: b.centroid,
          nodeId: b.nearestNodeId,
          attractivity: att,
        })
      }
    }

    if (amenities.length === 0) {
      setExplorerResults(null)
      return
    }

    const results = computeExplorerResults(
      explorerNodeId,
      amenities,
      graph,
      fullNetworkMatrix,
      evaluator,
      undefined, // maxDisplay (use default)
      distanceMode,
      explorerLocation
    )

    setExplorerResults(results.length > 0 ? results : null)
  }, [isExplorerActive, explorerLocation, explorerNodeId, graph, fullNetworkMatrix, gridAttractors, buildings, selectedLandUse, attractivityMode, isGridMode, isSurfaceMode, curveTabMode, customCurveType, polylinePoints, bezierHandles, maxDistance, negExpAlpha, expPowerB, expPowerC, setExplorerResults, distanceMode])

  // Explorer tool: sync flag marker, path rendering, and distance labels
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current) return

    // Helper to clean up all explorer visuals
    const cleanupExplorerVisuals = () => {
      // Remove flag marker
      if (explorerFlagMarkerRef.current) {
        explorerFlagMarkerRef.current.remove()
        explorerFlagMarkerRef.current = null
      }
      // Remove label markers
      for (const marker of explorerLabelMarkersRef.current.values()) {
        marker.remove()
      }
      explorerLabelMarkersRef.current.clear()
      // Remove path layer
      if (map.getLayer('explorer-paths-layer')) {
        map.removeLayer('explorer-paths-layer')
      }
      if (map.getSource('explorer-paths')) {
        map.removeSource('explorer-paths')
      }
    }

    // If explorer is not active, clean up
    if (!isExplorerActive) {
      cleanupExplorerVisuals()
      // Reset all attractor markers and terrain pins to default yellow + restore numbered labels
      for (let idx = 0; idx < gridAttractors.length; idx++) {
        const marker = attractorMarkersRef.current.get(gridAttractors[idx].id)
        if (marker) {
          updateAttractorMarkerColor(marker.getElement(), null)
          updateAttractorMarkerLabel(marker.getElement(), idx + 1, gridAttractors[idx].attractivity)
        }
      }
      for (const pinEl of pinElementsRef.current.values()) {
        const pinPath = pinEl.querySelector('path') as SVGPathElement | null
        if (pinPath) pinPath.setAttribute('fill', '#fcdb02')
      }
      return
    }

    // Handle flag marker
    if (explorerLocation) {
      if (!explorerFlagMarkerRef.current) {
        const el = createExplorerFlagElement()
        explorerFlagMarkerRef.current = new maplibregl.Marker({
          element: el,
          draggable: true,
          anchor: 'bottom',
        })
          .setLngLat(explorerLocation)
          .addTo(map)

        explorerFlagMarkerRef.current.on('dragend', () => {
          const lngLat = explorerFlagMarkerRef.current!.getLngLat()
          setExplorerLocationRef.current([lngLat.lng, lngLat.lat])
        })

        // Right-click to remove flag and clear results
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault()
          e.stopPropagation()
          clearExplorer()
        })
      } else {
        explorerFlagMarkerRef.current.setLngLat(explorerLocation)
      }
    } else {
      // Remove flag if location is null
      if (explorerFlagMarkerRef.current) {
        explorerFlagMarkerRef.current.remove()
        explorerFlagMarkerRef.current = null
      }
    }

    // Render paths and labels when results exist
    if (explorerResults && explorerResults.length > 0) {
      // Build GeoJSON features for all paths
      const features: GeoJSON.Feature[] = explorerResults
        .filter(r => r.networkPath.length >= 2)
        .map(r => ({
          type: 'Feature' as const,
          properties: { color: r.color, amenityId: r.amenityId },
          geometry: {
            type: 'LineString' as const,
            coordinates: r.networkPath,
          },
        }))

      const pathData: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features,
      }

      if (map.getSource('explorer-paths')) {
        (map.getSource('explorer-paths') as maplibregl.GeoJSONSource).setData(pathData)
      } else {
        map.addSource('explorer-paths', {
          type: 'geojson',
          data: pathData,
        })
        map.addLayer({
          id: 'explorer-paths-layer',
          type: 'line',
          source: 'explorer-paths',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 5,
            'line-opacity': 0.8,
            ...(distanceMode === 'euclidean' ? { 'line-dasharray': [1, 2.5] } : {}),
          },
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
        })
      }

      // Update dash pattern based on distance mode
      if (map.getLayer('explorer-paths-layer')) {
        map.setPaintProperty('explorer-paths-layer', 'line-dasharray',
          distanceMode === 'euclidean' ? [1, 2.5] : null
        )
      }

      // Manage distance labels
      const currentLabelIds = new Set(explorerResults.map(r => r.amenityId))

      // Remove stale labels
      for (const [id, marker] of explorerLabelMarkersRef.current) {
        if (!currentLabelIds.has(id)) {
          marker.remove()
          explorerLabelMarkersRef.current.delete(id)
        }
      }

      // Add or update labels
      for (const result of explorerResults) {
        if (result.networkPath.length < 2) continue

        const midpoint = getPathMidpoint(result.networkPath)
        const distStr = formatDistance(result.networkDistance)
        let label = explorerLabelMarkersRef.current.get(result.amenityId)

        if (!label) {
          const el = createExplorerDistanceLabelElement(distStr, result.color)
          label = new maplibregl.Marker({
            element: el,
            anchor: 'center',
          })
            .setLngLat(midpoint)
            .addTo(map)
          explorerLabelMarkersRef.current.set(result.amenityId, label)
        } else {
          label.setLngLat(midpoint)
          const el = label.getElement()
          el.textContent = distStr
          el.style.backgroundColor = result.color
        }
      }
      // Color attractor pins and update labels by their explorer palette color
      for (let i = 0; i < explorerResults.length; i++) {
        const result = explorerResults[i]
        const marker = attractorMarkersRef.current.get(result.amenityId)
        if (marker) {
          updateAttractorMarkerColor(marker.getElement(), result.color)
          updateAttractorMarkerLabel(marker.getElement(), i + 1, result.attractivity)
        }
        // Also color terrain pin SVGs (Surface mode)
        const pinEl = pinElementsRef.current.get(result.amenityId)
        if (pinEl) {
          const pinPath = pinEl.querySelector('path') as SVGPathElement | null
          if (pinPath) pinPath.setAttribute('fill', result.color)
        }
      }
      // Update flag score label
      if (explorerFlagMarkerRef.current) {
        const totalScore = explorerResults.reduce((sum, r) => sum + r.partialScore, 0)
        updateExplorerFlagScore(explorerFlagMarkerRef.current.getElement(), totalScore)
      }
    } else {
      // No results yet: remove paths and labels
      if (map.getLayer('explorer-paths-layer')) {
        map.removeLayer('explorer-paths-layer')
      }
      if (map.getSource('explorer-paths')) {
        map.removeSource('explorer-paths')
      }
      for (const marker of explorerLabelMarkersRef.current.values()) {
        marker.remove()
      }
      explorerLabelMarkersRef.current.clear()

      // Apply preview colors immediately (before flag placement)
      if (explorerAmenityPreview) {
        for (let i = 0; i < explorerAmenityPreview.length; i++) {
          const p = explorerAmenityPreview[i]
          const marker = attractorMarkersRef.current.get(p.id)
          if (marker) {
            updateAttractorMarkerColor(marker.getElement(), p.color)
            updateAttractorMarkerLabel(marker.getElement(), i + 1, p.attractivity)
          }
          // Also color terrain pin SVGs (Surface mode)
          const pinEl = pinElementsRef.current.get(p.id)
          if (pinEl) {
            const pinPath = pinEl.querySelector('path') as SVGPathElement | null
            if (pinPath) pinPath.setAttribute('fill', p.color)
          }
        }
      }

      // Clear flag score label
      if (explorerFlagMarkerRef.current) {
        updateExplorerFlagScore(explorerFlagMarkerRef.current.getElement(), null)
      }
    }
  }, [isExplorerActive, explorerLocation, explorerResults, explorerAmenityPreview, setExplorerResults, clearExplorer, distanceMode])

  // Update cursor when measurement mode changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current) return

    // Clear hover popup when measurement or explorer activates (especially terrain popup in Surface mode)
    if ((isMeasurementActive || isExplorerActive) && popupRef.current) {
      popupRef.current.remove()
      popupRef.current = null
    }

    const canvas = map.getCanvas()
    if (isMeasurementActive && measurementPointA && measurementPointB) {
      // Both points placed - show crosshair for next click (reset)
      canvas.style.cursor = 'crosshair'
    } else if (isMeasurementActive) {
      // Ghost marker follows cursor - hide system cursor
      canvas.style.cursor = 'none'
    } else if (isExplorerActive && !explorerLocation) {
      // Ghost flag follows cursor - hide system cursor
      canvas.style.cursor = 'none'
    } else if (isExplorerActive && explorerLocation) {
      canvas.style.cursor = 'crosshair'
    } else if (isGridMode || isSurfaceMode) {
      canvas.style.cursor = 'crosshair'
    } else if (isCustomMode) {
      canvas.style.cursor = 'crosshair'
    } else {
      canvas.style.cursor = ''
    }
  }, [isMeasurementActive, measurementPointA, measurementPointB, isExplorerActive, explorerLocation, isCustomMode, isGridMode, isSurfaceMode])

  // Reduce building/grid/terrain opacity when measurement or explorer is active
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current) return

    const toolActive = isMeasurementActive || isExplorerActive
    const opacity = toolActive ? 0.3 : 1

    // Update building layers opacity
    if (map.getLayer('buildings-fill')) {
      map.setPaintProperty('buildings-fill', 'fill-extrusion-opacity', opacity)
    }

    // Update hexagon grid opacity (both fill and outline)
    if (map.getLayer('hexagons-fill')) {
      map.setPaintProperty('hexagons-fill', 'fill-opacity', toolActive ? 0.4 : 0.85)
    }
    if (map.getLayer('hexagons-outline')) {
      map.setPaintProperty('hexagons-outline', 'line-opacity', toolActive ? 0.1 : 0.2)
    }

    // Update terrain (Surface mode): reduce opacity, hide 3D streets, show 2D streets
    if (isSurfaceMode && isTerrainLayerInitialized()) {
      setTerrainMeshOpacity(toolActive ? 0.5 : 1)
      setTerrainStreetNetworkVisibility(!toolActive)
      setStreetLayersVisibility(map, toolActive)
    }
  }, [isMeasurementActive, isExplorerActive, isSurfaceMode])

  // Ghost flag overlay: follows cursor when explorer is active but no flag placed yet
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current || !containerRef.current) return

    // Only show ghost flag when explorer is active and no location placed
    if (!isExplorerActive || explorerLocation) return

    // Create ghost flag element (flag icon only, no score)
    const ghost = document.createElement('div')
    ghost.className = 'explorer-ghost-flag'
    ghost.innerHTML = `
      <div class="explorer-flag-icon">
        <svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="5" y1="2" x2="5" y2="35" stroke="#333" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M5 2l20 7-20 7z" fill="#333" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
      </div>
    `
    ghost.style.display = 'none'
    containerRef.current.appendChild(ghost)

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      // Position ghost flag: offset so post bottom (tip) aligns with cursor
      // In the 28×36 viewBox, the post bottom is at (x=5, y=35)
      const point = e.point
      ghost.style.display = 'flex'
      ghost.style.transform = `translate(${point.x - 5}px, ${point.y - 36}px)`
    }

    const onMouseLeave = () => {
      ghost.style.display = 'none'
    }

    map.on('mousemove', onMouseMove)
    map.getCanvas().addEventListener('mouseleave', onMouseLeave)

    return () => {
      map.off('mousemove', onMouseMove)
      map.getCanvas().removeEventListener('mouseleave', onMouseLeave)
      ghost.remove()
    }
  }, [mapLoaded, isExplorerActive, explorerLocation])

  // Ghost A/B marker overlay: follows cursor when measurement is active but points not yet placed
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoadedRef.current || !containerRef.current) return

    if (!isMeasurementActive) return

    // Determine which label to show
    let label: string | null = null
    if (!measurementPointA) {
      label = 'A'
    } else if (!measurementPointB) {
      label = 'B'
    }
    // Both placed → no ghost needed
    if (!label) return

    // Create ghost marker element (same visual as real measurement markers)
    const ghost = document.createElement('div')
    ghost.className = 'measurement-ghost-marker'
    ghost.innerHTML = `<div class="measurement-marker-circle">${label}</div>`
    ghost.style.display = 'none'
    containerRef.current.appendChild(ghost)

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      // Center the 28px circle on cursor
      const point = e.point
      ghost.style.display = 'block'
      ghost.style.transform = `translate(${point.x - 14}px, ${point.y - 14}px)`
    }

    const onMouseLeave = () => {
      ghost.style.display = 'none'
    }

    map.on('mousemove', onMouseMove)
    map.getCanvas().addEventListener('mouseleave', onMouseLeave)

    return () => {
      map.off('mousemove', onMouseMove)
      map.getCanvas().removeEventListener('mouseleave', onMouseLeave)
      ghost.remove()
    }
  }, [mapLoaded, isMeasurementActive, measurementPointA, measurementPointB])

  // Exit measurement mode on Escape key
  useEffect(() => {
    if (!isMeasurementActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMeasurementActive(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMeasurementActive, setMeasurementActive])

  return (
    <div ref={containerRef} className="absolute inset-0" />
  )
}
