import { useState, useRef, useEffect } from 'react'
import { useAppContext } from '../../context/AppContext'

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
    isPanelCollapsed,
    buildingFilterMode,
    gradientRangeMode,
    fixedGradientMin,
    fixedGradientMax,
    setGradientRangeMode,
    setFixedGradientMin,
    setFixedGradientMax,
  } = useAppContext()

  const [editingMin, setEditingMin] = useState(false)
  const [editingMax, setEditingMax] = useState(false)
  const [tempMinValue, setTempMinValue] = useState('')
  const [tempMaxValue, setTempMaxValue] = useState('')
  const minInputRef = useRef<HTMLInputElement>(null)
  const maxInputRef = useRef<HTMLInputElement>(null)

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

  // Focus input when editing starts
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

  // On mobile: hidden when panel is open, bottom-left when panel is collapsed
  // On desktop: always bottom-left
  const mobileVisibility = isPanelCollapsed ? '' : 'hidden sm:block'

  return (
    <div className={`absolute bottom-4 left-4 sm:bottom-8 sm:left-auto sm:right-5 py-4 pointer-events-auto ${mobileVisibility}`}>
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
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs text-white invisible">Low</span>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4" /> {/* spacer to align with circles above */}
          <span className="text-sm text-white">Accessibility Score</span>
          <div className="inline-flex rounded-full bg-white/20 p-0.5">
            <button
              onClick={() => setGradientRangeMode('adaptive')}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
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
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
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

      {/* Gradient bar with average marker */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-white w-12 text-center">Low</span>
        <div className="relative w-40 sm:w-56">
          {/* Gradient bar */}
          <div
            className="w-full h-4 rounded-full"
            style={{
              background: 'linear-gradient(to right, #4A3AB4, #FD681D, #FD1D1D)',
            }}
          />
          {/* Average marker line */}
          {range > 0 && (
            <div
              className="absolute top-0 h-4 w-0.5 bg-white rounded-full"
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
