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
  } = useAppContext()

  const isGridMode = analysisMode === 'grid'

  // Use appropriate scores based on mode
  const displayMinScore = isGridMode ? gridMinRawScore : minRawScore
  const displayMaxScore = isGridMode ? gridMaxRawScore : maxRawScore

  return (
    <div className="absolute bottom-8 right-8 glass-panel floating-panel px-5 py-4">
      {isGridMode ? (
        <>
          {/* Grid Mode: Attractor Indicator */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 invisible">Low</span>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: '#fcdb02' }}
              />
              <span className="text-sm text-gray-600">
                Attractors ({gridAttractors.length})
              </span>
            </div>
          </div>

          {/* Hexagon Indicator */}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-gray-500 invisible">Low</span>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{
                  background: 'linear-gradient(135deg, #4A3AB4 0%, #FD681D 50%, #FD1D1D 100%)',
                }}
              />
              <span className="text-sm text-gray-600">Hexagon Grid</span>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Buildings Mode: Selected Amenity Indicator */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 invisible">Low</span>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: '#fcdb02' }}
              />
              <span className="text-sm text-gray-600">
                {selectedLandUse === 'Custom' ? 'Custom Pins' : selectedLandUse}
              </span>
            </div>
          </div>

          {/* Other Buildings Indicator */}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-gray-500 invisible">Low</span>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: '#a0a0a0' }}
              />
              <span className="text-sm text-gray-600">Other Amenities</span>
            </div>
          </div>
        </>
      )}

      {/* Divider */}
      <div className="border-t border-gray-200 my-4" />

      {/* Accessibility Score */}
      <label className="text-base font-medium text-gray-600 block mb-3">
        Accessibility Score
      </label>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">Low</span>
        <div
          className="w-56 h-4 rounded"
          style={{
            background: 'linear-gradient(to right, #4A3AB4, #FD681D, #FD1D1D)',
          }}
        />
        <span className="text-xs text-gray-500">High</span>
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-500 px-8">
        <span>{displayMinScore.toFixed(1)}</span>
        <span>{displayMaxScore.toFixed(1)}</span>
      </div>
    </div>
  )
}
