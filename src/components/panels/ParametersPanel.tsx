import { useAppContext } from '../../context/AppContext'
import { CurveEditor } from '../CurveEditor/CurveEditor'
import { AmenityDropdown } from './AmenityDropdown'
import { AttractivityDropdown } from './AttractivityDropdown'
import { AnalysisModeToggle } from './AnalysisModeToggle'

export function ParametersPanel() {
  const {
    isPanelCollapsed,
    setIsPanelCollapsed,
    analysisMode,
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
    isComputingFullMatrix,
    loadingStatus,
    totalGridAttractivity,
  } = useAppContext()

  if (isLoading) return null

  const isGridMode = analysisMode === 'grid'

  return (
    <div className="absolute top-0 left-0 right-0 sm:top-3 sm:left-3 sm:right-auto glass-panel floating-panel p-3 sm:p-4 w-full sm:w-[540px] rounded-none sm:rounded-2xl max-h-[calc(100vh-16px)] sm:max-h-[calc(100vh-24px)] flex flex-col overflow-x-hidden">
      {/* Title - clickable to collapse/expand */}
      <button
        className="w-full flex items-center justify-between text-left flex-shrink-0"
        onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
      >
        <h2 className="text-xl sm:text-2xl font-semibold" style={{ color: '#5633ac' }}>
          Accessibility Analysis
        </h2>
        <span className="text-gray-400 text-lg">
          {isPanelCollapsed ? '▼' : '▲'}
        </span>
      </button>

      {/* Scrollable content area */}
      <div className="overflow-y-auto flex-1 min-h-0">
        {/* Introduction and Master Equation */}
        <p className="text-xs sm:text-sm text-gray-600 mt-2 sm:mt-3 mb-2">
          Accessibility measures how well a location is served by nearby amenities.
          For each location <i>i</i>, we sum the attractivity <strong>Att<sub>j</sub></strong> of every
          amenity <i>j</i>, weighted by how much the distance <strong>d<sub>ij</sub></strong> reduces
          its influence via the decay function <strong>f(d<sub>ij</sub>)</strong>.
        </p>
        <div className="equation text-center mb-3">
          Acc<sub>i</sub> = Σ Att<sub>j</sub> × f(d<sub>ij</sub>)
        </div>

        {/* Collapsible content */}
        {!isPanelCollapsed && (
          <div className="mt-1">
            {/* Mode Toggle */}
            <AnalysisModeToggle />

            {/* Section B: Parameters (Buildings mode) or Amenity Info (Grid mode) */}
            {isGridMode ? (
              <div className="mb-4">
                {isComputingFullMatrix && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 mb-3">
                    <p className="text-xs sm:text-sm text-purple-700">{loadingStatus}</p>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  {/* Left column: Amenities */}
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-600 block mb-1">
                      Amenities (j)
                    </label>
                    <p className="text-xs text-gray-500">Add amenities by clicking on map</p>
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
                      Attractivity (Att<sub>j</sub>)
                    </label>
                    <p className="text-xs text-gray-500">Set attractivity on map</p>
                    <span className="text-sm font-semibold mt-1 block" style={{ color: '#d4a800' }}>
                      Total: {totalGridAttractivity}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-600 block mb-1">
                    Amenity Type (j)
                  </label>
                  <AmenityDropdown />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-600 block mb-1">
                    Attractivity (Att<sub>j</sub>)
                  </label>
                  <AttractivityDropdown />
                </div>
              </div>
            )}

            {/* Section C: Distance Function */}
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-2">
                Distance Decay Function f(d<sub>ij</sub>)
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
        )}
      </div>
    </div>
  )
}
