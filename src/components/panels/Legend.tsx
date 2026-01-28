import { useAppContext } from '../../context/AppContext'

export function Legend() {
  const {
    minRawScore,
    maxRawScore,
    avgRawScore,
    selectedLandUse,
    analysisMode,
    gridMinRawScore,
    gridMaxRawScore,
    gridAvgRawScore,
    gridAttractors,
    isPanelCollapsed,
  } = useAppContext()

  const isGridMode = analysisMode === 'grid'

  // Use appropriate scores based on mode
  const displayMinScore = isGridMode ? gridMinRawScore : minRawScore
  const displayMaxScore = isGridMode ? gridMaxRawScore : maxRawScore
  const displayAvgScore = isGridMode ? gridAvgRawScore : avgRawScore

  // Calculate average position as percentage
  const range = displayMaxScore - displayMinScore
  const avgPercent = range > 0 ? ((displayAvgScore - displayMinScore) / range) * 100 : 50

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

          {/* Hexagon Indicator */}
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
                {selectedLandUse === 'Custom' ? 'Custom Pins' : selectedLandUse}
              </span>
            </div>
          </div>

          {/* Other Buildings Indicator */}
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
        </>
      )}

      {/* Divider */}
      <div className="border-t border-white/30 my-4" />

      {/* Accessibility Score */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs text-white invisible">Low</span>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4" /> {/* spacer to align with circles above */}
          <span className="text-sm text-white">Accessibility Score</span>
        </div>
      </div>

      {/* Gradient bar with average marker */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-white w-8 text-right">Low</span>
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
        <span className="text-xs text-white w-8">High</span>
      </div>

      {/* Score labels with average */}
      <div className="flex items-center gap-3 mt-2 text-xs text-white">
        <span className="w-8 text-right">{displayMinScore.toFixed(1)}</span>
        <div className="relative w-40 sm:w-56">
          {/* Average label positioned at marker */}
          {range > 0 && (
            <div
              className="absolute"
              style={{ left: `${avgPercent}%`, transform: 'translateX(-50%)' }}
            >
              {displayAvgScore.toFixed(1)} avg
            </div>
          )}
        </div>
        <span className="w-8">{displayMaxScore.toFixed(1)}</span>
      </div>
    </div>
  )
}
