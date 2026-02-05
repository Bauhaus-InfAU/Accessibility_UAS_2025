import { useState, useRef, useEffect } from 'react'
import { useAppContext } from '../../context/AppContext'
import { CurveEditor } from '../CurveEditor/CurveEditor'
import { AmenityDropdown } from './AmenityDropdown'
import { AttractivityDropdown } from './AttractivityDropdown'
import { AnalysisModeToggle } from './AnalysisModeToggle'
import { PillToggle } from './PillToggle'
import { HexSizeSlider } from './HexSizeSlider'
import { ParameterSlider } from './ParameterSlider'
import type { BuildingFilterMode } from '../../config/types'
import {
  TERRAIN_SMOOTH_MIN,
  TERRAIN_SMOOTH_MAX,
  TERRAIN_SMOOTH_STEP,
  TERRAIN_HEIGHT_MIN,
  TERRAIN_HEIGHT_MAX,
  TERRAIN_HEIGHT_STEP,
} from '../../config/constants'

// Minimum panel height in pixels
const MIN_PANEL_HEIGHT = 150

export function ParametersPanel() {
  const {
    isPanelCollapsed,
    setIsPanelCollapsed,
    panelHeight,
    setPanelHeight,
    analysisMode,
    buildingFilterMode,
    setBuildingFilterMode,
    curveTabMode,
    polylinePoints,
    maxDistance,
    negExpAlpha,
    expPowerB,
    expPowerC,
    setCurveTabMode,
    setPolylinePoints,
    setNegExpAlpha,
    setExpPowerB,
    setExpPowerC,
    isLoading,
    gridAttractors,
    clearGridAttractors,
    totalGridAttractivity,
    hexDiameter,
    setHexDiameter,
    isRegeneratingGrid,
    terrainSmoothing,
    setTerrainSmoothing,
    terrainHeightScale,
    setTerrainHeightScale,
  } = useAppContext()

  // Resize drag state
  const [isDragging, setIsDragging] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef<number>(0)
  const startHeightRef = useRef<number>(0)

  // Handle resize drag with window-level event listeners
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      const deltaY = e.clientY - startYRef.current
      // Calculate max height based on viewport (same as CSS max-height)
      const isMobile = window.innerWidth < 640
      const maxHeight = window.innerHeight - (isMobile ? 92 : 76)
      const newHeight = Math.max(MIN_PANEL_HEIGHT, Math.min(maxHeight, startHeightRef.current + deltaY))
      setPanelHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    // Touch support
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0]
        const deltaY = touch.clientY - startYRef.current
        const isMobile = window.innerWidth < 640
        const maxHeight = window.innerHeight - (isMobile ? 92 : 76)
        const newHeight = Math.max(MIN_PANEL_HEIGHT, Math.min(maxHeight, startHeightRef.current + deltaY))
        setPanelHeight(newHeight)
      }
    }

    const handleTouchEnd = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isDragging, setPanelHeight])

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    startYRef.current = clientY
    // Get current panel height
    if (panelRef.current) {
      startHeightRef.current = panelRef.current.getBoundingClientRect().height
    }
    setIsDragging(true)
  }

  if (isLoading) return null

  const isGridMode = analysisMode === 'grid'
  const isSurfaceMode = analysisMode === 'surface'
  const isBuildingsMode = analysisMode === 'buildings'
  // Show attractor controls in Grid, Surface mode
  const showAttractorControls = isGridMode || isSurfaceMode

  return (
    <div
      ref={panelRef}
      className="absolute top-0 left-0 right-0 sm:top-3 sm:left-3 sm:right-auto glass-panel floating-panel p-3 sm:p-4 w-full sm:w-[540px] rounded-none sm:rounded-2xl max-h-[calc(100vh-92px)] sm:max-h-[calc(100vh-76px)] flex flex-col overflow-x-hidden"
      style={{
        height: panelHeight && !isPanelCollapsed ? `${panelHeight}px` : undefined,
      }}
    >
      {/* Title - clickable to collapse/expand */}
      <button
        className="w-full flex items-center justify-between text-left flex-shrink-0"
        onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
      >
        <h2 className="text-xl sm:text-2xl font-semibold" style={{ color: '#5633ac' }}>
          Accessibility Analysis
        </h2>
        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-white text-gray-600 text-sm mr-4">
          {isPanelCollapsed ? '∨' : '∧'}
        </span>
      </button>

      {/* Scrollable content area */}
      <div className="overflow-y-auto flex-1 min-h-0">
        {/* Collapsible content */}
        {!isPanelCollapsed && (
          <>
        {/* Introduction and Master Equation */}
        <p className="text-xs sm:text-sm text-gray-600 mt-2 sm:mt-3 mb-2">
          Accessibility measures how well a location is served by nearby amenities.
          For each location <span className="math-var">i</span>, we sum the attractivity <span className="math-var">Att<sub>j</sub></span> of every
          amenity <span className="math-var">j</span>, weighted by how much the distance <span className="math-var">d<sub>ij</sub></span> reduces
          its influence via the decay function <span className="math-var">f(d<sub>ij</sub>)</span>.
        </p>
        <div className="equation text-center mb-3 flex items-center justify-center gap-1">
          <span>Acc<sub>i</sub> =</span>
          <span className="inline-flex flex-col items-center mx-1" style={{ fontSize: '0.65em', lineHeight: 1 }}>
            <span>N</span>
            <span style={{ fontSize: '1.8em', lineHeight: 0.9 }}>Σ</span>
            <span>j=1</span>
          </span>
          <span>[Att<sub>j</sub> × f(d<sub>ij</sub>)]</span>
        </div>
          <div className="mt-1">
            {/* Mode Toggle */}
            <AnalysisModeToggle />

            {/* Mode Description */}
            <p className="text-xs text-gray-500 mb-3">
              {isBuildingsMode && "Calculate accessibility for buildings based on proximity to amenities."}
              {isGridMode && "Visualize accessibility on a hexagonal grid, independent of buildings."}
              {isSurfaceMode && "Display accessibility as a 3D terrain with height representing scores."}
            </p>

            {/* Hexagon Size - Grid mode only */}
            {isGridMode && (
              <div className="mb-4">
                <HexSizeSlider
                  value={hexDiameter}
                  onChange={setHexDiameter}
                  disabled={isRegeneratingGrid}
                  label={isRegeneratingGrid ? "Hexagon Size (updating...)" : "Hexagon Size"}
                />
              </div>
            )}

            {/* Terrain Sliders - Surface mode only */}
            {isSurfaceMode && (
              <div className="mb-4">
                <ParameterSlider
                  value={terrainSmoothing}
                  onChange={setTerrainSmoothing}
                  min={TERRAIN_SMOOTH_MIN}
                  max={TERRAIN_SMOOTH_MAX}
                  step={TERRAIN_SMOOTH_STEP}
                  label="Terrain Smoothing"
                  decimals={1}
                />
                <ParameterSlider
                  value={terrainHeightScale}
                  onChange={setTerrainHeightScale}
                  min={TERRAIN_HEIGHT_MIN}
                  max={TERRAIN_HEIGHT_MAX}
                  step={TERRAIN_HEIGHT_STEP}
                  label="Terrain Height"
                  unit="m"
                />
              </div>
            )}

            {/* Analysis Scope - Buildings mode only, placed before amenity selection */}
            {isBuildingsMode && (
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-600 block mb-1.5">
                  Analysis Scope (<span className="math-var">i</span>)
                </label>
                <PillToggle
                  options={[
                    { value: 'residential', label: 'Residential' },
                    { value: 'all', label: 'All Buildings' },
                  ]}
                  value={buildingFilterMode}
                  onChange={(v) => setBuildingFilterMode(v as BuildingFilterMode)}
                />
              </div>
            )}

            {/* Section B: Parameters - mode-dependent UI */}
            {showAttractorControls ? (
              <div className="mb-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  {/* Left column: Custom Amenities */}
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-600 block mb-1">
                      Custom Amenities (<span className="math-var">j</span>)
                    </label>
                    <p className="instruction-text">Add amenities by clicking on map</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-semibold" style={{ color: '#d4a800' }}>
                        Total: {gridAttractors.length}
                      </span>
                      {gridAttractors.length > 0 && (
                        <button
                          className="text-red-500 hover:text-red-700 text-xs underline"
                          onClick={clearGridAttractors}
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right column: Attractivity */}
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-600 block mb-1">
                      Attractivity (<span className="math-var">Att<sub>j</sub></span>)
                    </label>
                    <p className="instruction-text">Set attractivity on map</p>
                    <span className="text-sm font-semibold mt-1 block" style={{ color: '#d4a800' }}>
                      Total: {totalGridAttractivity}
                    </span>
                  </div>
                </div>
              </div>
            ) : isBuildingsMode ? (
              <div className="mb-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-600 block mb-1">
                      Amenity Type (<span className="math-var">j</span>)
                    </label>
                    <AmenityDropdown />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-600 block mb-1">
                      Attractivity (<span className="math-var">Att<sub>j</sub></span>)
                    </label>
                    <AttractivityDropdown />
                  </div>
                </div>
              </div>
            ) : null}

            {/* Section C: Distance Function */}
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-2">
                Distance Decay Function <span className="math-var">f(d<sub>ij</sub>)</span>
              </label>
              <CurveEditor
              curveTabMode={curveTabMode}
              polylinePoints={polylinePoints}
              maxDistance={maxDistance}
              negExpAlpha={negExpAlpha}
              expPowerB={expPowerB}
              expPowerC={expPowerC}
              onTabModeChange={setCurveTabMode}
              onPolylineChange={setPolylinePoints}
              onNegExpAlphaChange={setNegExpAlpha}
              onExpPowerBChange={setExpPowerB}
              onExpPowerCChange={setExpPowerC}
            />
          </div>
          </div>
          </>
        )}
      </div>

      {/* Resize handle at bottom - only shown when not collapsed */}
      {!isPanelCollapsed && (
        <div
          className="resize-handle flex-shrink-0"
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
        >
          <div className="resize-handle-grip" />
        </div>
      )}
    </div>
  )
}
