import { useAppContext } from '../../context/AppContext'

export function Legend() {
  const {
    minRawScore,
    maxRawScore,
    selectedLandUse,
    analysisMode,
    gridMinRawScore,
    gridMaxRawScore,
    gridAttractors,
    isPanelCollapsed,
  } = useAppContext()

  const isGridMode = analysisMode === 'grid'

  // Use appropriate scores based on mode
  const displayMinScore = isGridMode ? gridMinRawScore : minRawScore
  const displayMaxScore = isGridMode ? gridMaxRawScore : maxRawScore

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
      <label className="text-base font-medium text-white block mb-3">
        Accessibility Score
      </label>
      <div className="flex items-center gap-3">
        <span className="text-xs text-white">Low</span>
        <div
          className="w-40 sm:w-56 h-4 rounded-full"
          style={{
            background: 'linear-gradient(to right, #4A3AB4, #FD681D, #FD1D1D)',
          }}
        />
        <span className="text-xs text-white">High</span>
      </div>
      <div className="flex justify-between mt-2 text-xs text-white px-8">
        <span>{displayMinScore.toFixed(1)}</span>
        <span>{displayMaxScore.toFixed(1)}</span>
      </div>
    </div>
  )
}
