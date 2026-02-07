import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppContext } from '../../context/AppContext'

// Helper: interpolate between two hex colors
function interpolateColor(color1: string, color2: string, t: number): string {
  const r1 = parseInt(color1.slice(1, 3), 16)
  const g1 = parseInt(color1.slice(3, 5), 16)
  const b1 = parseInt(color1.slice(5, 7), 16)
  const r2 = parseInt(color2.slice(1, 3), 16)
  const g2 = parseInt(color2.slice(3, 5), 16)
  const b2 = parseInt(color2.slice(5, 7), 16)

  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// Get gradient color at a given percentage (0-1)
function getGradientColorAtPercent(percent: number): string {
  const PURPLE = '#4A3AB4'
  const ORANGE = '#FD681D'
  const RED = '#FD1D1D'

  const clamped = Math.max(0, Math.min(1, percent))

  if (clamped <= 0.5) {
    return interpolateColor(PURPLE, ORANGE, clamped * 2)
  } else {
    return interpolateColor(ORANGE, RED, (clamped - 0.5) * 2)
  }
}

export function Legend() {
  const {
    minRawScore,
    maxRawScore,
    avgRawScore,
    selectedLandUse,
    analysisMode,
    gridMinScore,
    gridMaxScore,
    gridAvgScore,
    surfaceMinScore,
    surfaceMaxScore,
    surfaceAvgScore,
    gridAttractors,
    isMobileLegendOpen,
    buildingFilterMode,
    gradientRangeMode,
    fixedGradientMin,
    fixedGradientMax,
    setGradientRangeMode,
    setFixedGradientMin,
    setFixedGradientMax,
    // Filter range state
    filterRangeActive,
    filterRangeMinPercent,
    filterRangeMaxPercent,
    setFilterRangeActive,
    setFilterRangeMinPercent,
    setFilterRangeMaxPercent,
    clearFilterRange,
  } = useAppContext()

  // Fixed range editing state
  const [editingMin, setEditingMin] = useState(false)
  const [editingMax, setEditingMax] = useState(false)
  const [tempMinValue, setTempMinValue] = useState('')
  const [tempMaxValue, setTempMaxValue] = useState('')
  const minInputRef = useRef<HTMLInputElement>(null)
  const maxInputRef = useRef<HTMLInputElement>(null)

  // Filter range drag state
  const [isDragging, setIsDragging] = useState<'min' | 'max' | 'create' | null>(null)
  const [dragStartPercent, setDragStartPercent] = useState(0)
  const gradientRef = useRef<HTMLDivElement>(null)

  // Filter value editing state
  const [editingFilterMin, setEditingFilterMin] = useState(false)
  const [editingFilterMax, setEditingFilterMax] = useState(false)
  const [tempFilterMin, setTempFilterMin] = useState('')
  const [tempFilterMax, setTempFilterMax] = useState('')
  const filterMinInputRef = useRef<HTMLInputElement>(null)
  const filterMaxInputRef = useRef<HTMLInputElement>(null)

  const isGridMode = analysisMode === 'grid'
  const isSurfaceMode = analysisMode === 'surface'
  const isFixedMode = gradientRangeMode === 'fixed'

  // Use appropriate scores based on mode (these are always the raw data min/max/avg)
  const displayMinScore = isGridMode ? gridMinScore : (isSurfaceMode ? surfaceMinScore : minRawScore)
  const displayMaxScore = isGridMode ? gridMaxScore : (isSurfaceMode ? surfaceMaxScore : maxRawScore)
  const displayAvgScore = isGridMode ? gridAvgScore : (isSurfaceMode ? surfaceAvgScore : avgRawScore)

  // For gradient range, use fixed values in fixed mode, data values in adaptive mode
  const rangeMin = isFixedMode ? fixedGradientMin : displayMinScore
  const rangeMax = isFixedMode ? fixedGradientMax : displayMaxScore

  // Calculate average position as percentage (relative to current range, clamped)
  const range = rangeMax - rangeMin
  let avgPercent = 50
  if (range > 0) {
    avgPercent = ((displayAvgScore - rangeMin) / range) * 100
    avgPercent = Math.max(0, Math.min(100, avgPercent))
  }

  // Convert filter percent to raw score for display
  const filterMinScore = rangeMin + filterRangeMinPercent * range
  const filterMaxScore = rangeMin + filterRangeMaxPercent * range

  // Focus input when editing starts (fixed range)
  useEffect(() => {
    if (editingMin && minInputRef.current) {
      minInputRef.current.focus()
      minInputRef.current.select()
    }
  }, [editingMin])

  useEffect(() => {
    if (editingMax && maxInputRef.current) {
      maxInputRef.current.focus()
      maxInputRef.current.select()
    }
  }, [editingMax])

  // Focus input when editing filter values
  useEffect(() => {
    if (editingFilterMin && filterMinInputRef.current) {
      filterMinInputRef.current.focus()
      filterMinInputRef.current.select()
    }
  }, [editingFilterMin])

  useEffect(() => {
    if (editingFilterMax && filterMaxInputRef.current) {
      filterMaxInputRef.current.focus()
      filterMaxInputRef.current.select()
    }
  }, [editingFilterMax])

  const startEditingMin = () => {
    if (!isFixedMode) return
    setTempMinValue(fixedGradientMin.toString())
    setEditingMin(true)
  }

  const startEditingMax = () => {
    if (!isFixedMode) return
    setTempMaxValue(fixedGradientMax.toString())
    setEditingMax(true)
  }

  const finishEditingMin = () => {
    const value = parseFloat(tempMinValue)
    if (!isNaN(value)) {
      setFixedGradientMin(value)
    }
    setEditingMin(false)
  }

  const finishEditingMax = () => {
    const value = parseFloat(tempMaxValue)
    if (!isNaN(value)) {
      setFixedGradientMax(value)
    }
    setEditingMax(false)
  }

  const handleMinKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      finishEditingMin()
    } else if (e.key === 'Escape') {
      setEditingMin(false)
    }
  }

  const handleMaxKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      finishEditingMax()
    } else if (e.key === 'Escape') {
      setEditingMax(false)
    }
  }

  // Filter value editing
  const startEditingFilterMin = () => {
    if (!filterRangeActive) return
    setTempFilterMin(filterMinScore.toFixed(1))
    setEditingFilterMin(true)
  }

  const startEditingFilterMax = () => {
    if (!filterRangeActive) return
    setTempFilterMax(filterMaxScore.toFixed(1))
    setEditingFilterMax(true)
  }

  const finishEditingFilterMin = () => {
    const value = parseFloat(tempFilterMin)
    if (!isNaN(value) && range > 0) {
      const percent = Math.max(0, Math.min(1, (value - rangeMin) / range))
      setFilterRangeMinPercent(Math.min(percent, filterRangeMaxPercent))
    }
    setEditingFilterMin(false)
  }

  const finishEditingFilterMax = () => {
    const value = parseFloat(tempFilterMax)
    if (!isNaN(value) && range > 0) {
      const percent = Math.max(0, Math.min(1, (value - rangeMin) / range))
      setFilterRangeMaxPercent(Math.max(percent, filterRangeMinPercent))
    }
    setEditingFilterMax(false)
  }

  const handleFilterMinKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      finishEditingFilterMin()
    } else if (e.key === 'Escape') {
      setEditingFilterMin(false)
    }
  }

  const handleFilterMaxKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      finishEditingFilterMax()
    } else if (e.key === 'Escape') {
      setEditingFilterMax(false)
    }
  }

  // Calculate percent from mouse event
  const getPercentFromEvent = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!gradientRef.current) return 0
    const rect = gradientRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }, [])

  // Handle gradient bar mouse down - start creating filter range
  const handleGradientMouseDown = (e: React.MouseEvent) => {
    // Only handle left click
    if (e.button !== 0) return

    const percent = getPercentFromEvent(e)

    if (!filterRangeActive) {
      // Start creating new filter range via drag
      setFilterRangeActive(true)
      setFilterRangeMinPercent(percent)
      setFilterRangeMaxPercent(percent)
      setIsDragging('create')
      setDragStartPercent(percent)
    }
  }

  // Handle right-click to clear filter
  const handleGradientContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    if (filterRangeActive) {
      clearFilterRange()
    }
  }

  // Handle handle drag start
  const startHandleDrag = (handle: 'min' | 'max', e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDragging(handle)
  }

  // Mouse move handler for dragging
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const percent = getPercentFromEvent(e)

      if (isDragging === 'create') {
        // Creating new range - set min/max based on drag direction
        if (percent < dragStartPercent) {
          setFilterRangeMinPercent(percent)
          setFilterRangeMaxPercent(dragStartPercent)
        } else {
          setFilterRangeMinPercent(dragStartPercent)
          setFilterRangeMaxPercent(percent)
        }
      } else if (isDragging === 'min') {
        // Dragging min handle - don't exceed max
        setFilterRangeMinPercent(Math.min(percent, filterRangeMaxPercent))
      } else if (isDragging === 'max') {
        // Dragging max handle - don't go below min
        setFilterRangeMaxPercent(Math.max(percent, filterRangeMinPercent))
      }
    }

    const handleMouseUp = () => {
      setIsDragging(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStartPercent, filterRangeMaxPercent, filterRangeMinPercent, getPercentFromEvent, setFilterRangeMinPercent, setFilterRangeMaxPercent])

  // ESC key to clear filter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && filterRangeActive) {
        clearFilterRange()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filterRangeActive, clearFilterRange])

  // On mobile: shown only when mobileLegendOpen (toggled via "?" button)
  // On desktop: always visible (sm:block overrides hidden)
  const mobileVisibility = isMobileLegendOpen ? '' : 'hidden sm:block'

  return (
    <div className={`legend-container absolute bottom-12 left-4 sm:bottom-8 sm:left-auto sm:right-5 py-4 pointer-events-auto ${mobileVisibility}`}>
      {isGridMode ? (
        <>
          {/* Grid Mode: Custom Amenities Indicator */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-white invisible">Low</span>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: '#fcdb02' }}
              />
              <span className="text-sm text-white">
                Custom Amenities ({gridAttractors.length})
              </span>
            </div>
          </div>

          {/* Hexagon Grid Indicator */}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-white invisible">Low</span>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #4A3AB4 0%, #FD681D 50%, #FD1D1D 100%)',
                }}
              />
              <span className="text-sm text-white">Hexagon Grid</span>
            </div>
          </div>
        </>
      ) : isSurfaceMode ? (
        <>
          {/* Surface Mode: Custom Amenities Indicator */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-white invisible">Low</span>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: '#fcdb02' }}
              />
              <span className="text-sm text-white">
                Custom Amenities ({gridAttractors.length})
              </span>
            </div>
          </div>

          {/* Terrain Surface Indicator */}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-white invisible">Low</span>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #4A3AB4 0%, #FD681D 50%, #FD1D1D 100%)',
                }}
              />
              <span className="text-sm text-white">Terrain Surface</span>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Buildings Mode: Selected Amenity Indicator */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-white invisible">Low</span>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: '#fcdb02' }}
              />
              <span className="text-sm text-white">
                {selectedLandUse === 'Custom'
                  ? `Custom Amenities (${gridAttractors.length})`
                  : selectedLandUse}
              </span>
            </div>
          </div>

          {/* Other Buildings Indicator - hidden when Custom + All Buildings */}
          {!(selectedLandUse === 'Custom' && buildingFilterMode === 'all') && (
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-white invisible">Low</span>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: '#a0a0a0' }}
                />
                <span className="text-sm text-white">Other Amenities</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Divider */}
      <div className="border-t border-white/30 my-4" />

      {/* Accessibility Score Title with Pill Toggle */}
      <div className="flex items-center gap-3 mb-3 text-sm">
        <span className="text-xs text-white invisible">Low</span>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4" /> {/* spacer to align with circles above */}
          <span className="text-white">Accessibility Score</span>
          <div className="inline-flex rounded-full bg-white/20 p-0.5">
            <button
              onClick={() => setGradientRangeMode('adaptive')}
              className={`px-3 py-1 rounded-full transition-colors ${
                !isFixedMode
                  ? 'bg-white text-gray-700 shadow-sm'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Adaptive
            </button>
            <button
              onClick={() => {
                // Copy current adaptive values to fixed values before switching
                if (!isFixedMode) {
                  setFixedGradientMin(displayMinScore)
                  setFixedGradientMax(displayMaxScore)
                }
                setGradientRangeMode('fixed')
              }}
              className={`px-3 py-1 rounded-full transition-colors ${
                isFixedMode
                  ? 'bg-white text-gray-700 shadow-sm'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Fixed
            </button>
          </div>
        </div>
      </div>

      {/* Gradient bar with average marker and filter handles */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-white w-12 text-center">Low</span>
        <div
          ref={gradientRef}
          className="relative w-40 sm:w-56 cursor-crosshair"
          onMouseDown={handleGradientMouseDown}
          onContextMenu={handleGradientContextMenu}
        >
          {/* Gradient bar */}
          <div
            className="legend-gradient-bar w-full h-4 rounded-full"
            style={{
              background: 'linear-gradient(to right, #4A3AB4, #FD681D, #FD1D1D)',
            }}
          />

          {/* Filter range overlay - faded areas outside range */}
          {filterRangeActive && (
            <>
              {/* Left faded area */}
              {filterRangeMinPercent > 0 && (
                <div
                  className="absolute top-0 h-4 rounded-l-full bg-black/50"
                  style={{
                    left: 0,
                    width: `${filterRangeMinPercent * 100}%`,
                  }}
                />
              )}
              {/* Right faded area */}
              {filterRangeMaxPercent < 1 && (
                <div
                  className="absolute top-0 h-4 rounded-r-full bg-black/50"
                  style={{
                    left: `${filterRangeMaxPercent * 100}%`,
                    width: `${(1 - filterRangeMaxPercent) * 100}%`,
                  }}
                />
              )}
              {/* Connection line between handles */}
              <div
                className="absolute top-1/2 h-0.5 bg-white/70"
                style={{
                  left: `${filterRangeMinPercent * 100}%`,
                  width: `${(filterRangeMaxPercent - filterRangeMinPercent) * 100}%`,
                  transform: 'translateY(-50%)',
                }}
              />
              {/* Min handle */}
              <div
                className="filter-handle"
                style={{
                  left: `${filterRangeMinPercent * 100}%`,
                  backgroundColor: getGradientColorAtPercent(filterRangeMinPercent),
                }}
                onMouseDown={(e) => startHandleDrag('min', e)}
                title="Drag to adjust filter minimum"
              />
              {/* Max handle */}
              <div
                className="filter-handle"
                style={{
                  left: `${filterRangeMaxPercent * 100}%`,
                  backgroundColor: getGradientColorAtPercent(filterRangeMaxPercent),
                }}
                onMouseDown={(e) => startHandleDrag('max', e)}
                title="Drag to adjust filter maximum"
              />
              {/* Filter value labels - positioned below handles */}
              {range > 0 && (
                <>
                  {/* Min filter label */}
                  {editingFilterMin ? (
                    <input
                      ref={filterMinInputRef}
                      type="number"
                      value={tempFilterMin}
                      onChange={(e) => setTempFilterMin(e.target.value)}
                      onBlur={finishEditingFilterMin}
                      onKeyDown={handleFilterMinKeyDown}
                      className="absolute w-14 text-center bg-transparent border rounded outline-none text-white px-1 py-0.5 text-xs"
                      style={{
                        left: `${filterRangeMinPercent * 100}%`,
                        top: '20px',
                        transform: 'translateX(-50%)',
                        borderColor: getGradientColorAtPercent(filterRangeMinPercent),
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      }}
                      step="any"
                    />
                  ) : (
                    <button
                      className="absolute whitespace-nowrap cursor-pointer hover:underline font-semibold text-xs"
                      style={{
                        left: `${filterRangeMinPercent * 100}%`,
                        top: '20px',
                        transform: 'translateX(-50%)',
                        color: getGradientColorAtPercent(filterRangeMinPercent),
                      }}
                      onClick={startEditingFilterMin}
                      title="Click to edit filter minimum"
                    >
                      {filterMinScore.toFixed(1)}
                    </button>
                  )}
                  {/* Max filter label */}
                  {editingFilterMax ? (
                    <input
                      ref={filterMaxInputRef}
                      type="number"
                      value={tempFilterMax}
                      onChange={(e) => setTempFilterMax(e.target.value)}
                      onBlur={finishEditingFilterMax}
                      onKeyDown={handleFilterMaxKeyDown}
                      className="absolute w-14 text-center bg-transparent border rounded outline-none text-white px-1 py-0.5 text-xs"
                      style={{
                        left: `${filterRangeMaxPercent * 100}%`,
                        top: '20px',
                        transform: 'translateX(-50%)',
                        borderColor: getGradientColorAtPercent(filterRangeMaxPercent),
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      }}
                      step="any"
                    />
                  ) : (
                    <button
                      className="absolute whitespace-nowrap cursor-pointer hover:underline font-semibold text-xs"
                      style={{
                        left: `${filterRangeMaxPercent * 100}%`,
                        top: '20px',
                        transform: 'translateX(-50%)',
                        color: getGradientColorAtPercent(filterRangeMaxPercent),
                      }}
                      onClick={startEditingFilterMax}
                      title="Click to edit filter maximum"
                    >
                      {filterMaxScore.toFixed(1)}
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {/* Average marker line */}
          {range > 0 && (
            <div
              className="absolute top-0 h-4 w-0.5 bg-white rounded-full pointer-events-none"
              style={{ left: `${avgPercent}%`, transform: 'translateX(-50%)' }}
            />
          )}
        </div>
        <span className="text-xs text-white w-12 text-center">High</span>
      </div>

      {/* Score labels with average */}
      <div className="flex items-center gap-3 mt-2 text-xs text-white">
        {/* Min value */}
        {isFixedMode ? (
          editingMin ? (
            <input
              ref={minInputRef}
              type="number"
              value={tempMinValue}
              onChange={(e) => setTempMinValue(e.target.value)}
              onBlur={finishEditingMin}
              onKeyDown={handleMinKeyDown}
              className="w-12 text-center bg-transparent border border-[#4A3AB4] rounded-full outline-none text-white px-1 py-0.5"
              style={{ backgroundColor: 'rgba(74, 58, 180, 0.3)' }}
              step="any"
            />
          ) : (
            <button
              onClick={startEditingMin}
              className="w-12 text-center rounded-full px-1 py-0.5 cursor-pointer transition-colors hover:opacity-80"
              style={{ backgroundColor: '#4A3AB4' }}
              title="Click to edit minimum"
            >
              {fixedGradientMin.toFixed(1)}
            </button>
          )
        ) : (
          <span className="inline-block w-12 text-center px-1 py-0.5">{displayMinScore.toFixed(1)}</span>
        )}

        <div className="relative w-40 sm:w-56">
          {/* Average label positioned at marker */}
          {range > 0 && (
            <div
              className="absolute whitespace-nowrap"
              style={{ left: `${avgPercent}%`, transform: 'translateX(-50%)' }}
            >
              {displayAvgScore.toFixed(1)} avg
            </div>
          )}
        </div>

        {/* Max value */}
        {isFixedMode ? (
          editingMax ? (
            <input
              ref={maxInputRef}
              type="number"
              value={tempMaxValue}
              onChange={(e) => setTempMaxValue(e.target.value)}
              onBlur={finishEditingMax}
              onKeyDown={handleMaxKeyDown}
              className="w-12 text-center bg-transparent border border-[#FD1D1D] rounded-full outline-none text-white px-1 py-0.5"
              style={{ backgroundColor: 'rgba(253, 29, 29, 0.3)' }}
              step="any"
            />
          ) : (
            <button
              onClick={startEditingMax}
              className="w-12 text-center rounded-full px-1 py-0.5 cursor-pointer transition-colors hover:opacity-80"
              style={{ backgroundColor: '#FD1D1D' }}
              title="Click to edit maximum"
            >
              {fixedGradientMax.toFixed(1)}
            </button>
          )
        ) : (
          <span className="inline-block w-12 text-center px-1 py-0.5">{displayMaxScore.toFixed(1)}</span>
        )}
      </div>
    </div>
  )
}
