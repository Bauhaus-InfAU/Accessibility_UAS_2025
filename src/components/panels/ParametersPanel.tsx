import { useState } from 'react'
import { useAppContext } from '../../context/AppContext'
import { CurveEditor } from '../CurveEditor/CurveEditor'
import { AmenityDropdown } from './AmenityDropdown'
import { AttractivityDropdown } from './AttractivityDropdown'
import { AnalysisModeToggle } from './AnalysisModeToggle'

export function ParametersPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const {
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
    <div className="absolute top-5 left-5 glass-panel floating-panel p-5 w-[540px]">
      {/* Title - clickable to collapse/expand */}
      <button
        className="w-full flex items-center justify-between text-left"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h2 className="text-2xl font-semibold text-gray-800">
          Accessibility Analysis
        </h2>
        <span className="text-gray-400 text-xl">
          {isCollapsed ? '▼' : '▲'}
        </span>
      </button>

      {/* Collapsible content */}
      {!isCollapsed && (
        <div className="mt-4">
          {/* Mode Toggle */}
          <AnalysisModeToggle />

          {/* Section A: Introduction and Master Equation */}
          <p className="text-sm text-gray-600 mb-3">
            {isGridMode ? (
              <>
                Grid mode calculates accessibility on a hexagonal grid.
                For each grid cell <i>i</i>, we sum the attractivity <strong>Att<sub>j</sub></strong> of every
                amenity <i>j</i>, weighted by how much the distance <strong>d<sub>ij</sub></strong> reduces
                its influence via the decay function <strong>f(d<sub>ij</sub>)</strong>.
                Click on the map to place amenities.
              </>
            ) : (
              <>
                Accessibility measures how well a location is served by nearby amenities.
                For each location <i>i</i>, we sum the attractivity <strong>Att<sub>j</sub></strong> of every
                amenity <i>j</i>, weighted by how much the distance <strong>d<sub>ij</sub></strong> reduces
                its influence via the decay function <strong>f(d<sub>ij</sub>)</strong>.
              </>
            )}
          </p>
          <div className="equation text-center mb-6">
            Acc<sub>i</sub> = Σ Att<sub>j</sub> × f(d<sub>ij</sub>)
          </div>

          {/* Section B: Parameters (Buildings mode) or Amenity Info (Grid mode) */}
          {isGridMode ? (
            <div className="mb-6">
              {isComputingFullMatrix && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-purple-700">{loadingStatus}</p>
                </div>
              )}
              <div className="flex gap-6">
                {/* Left column: Amenities */}
                <div className="flex-1">
                  <label className="text-base font-medium text-gray-600 block mb-2">
                    Amenities (j)
                  </label>
                  <p className="text-xs text-gray-500">Add amenities by clicking on map</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm font-semibold" style={{ color: '#d4a800' }}>
                      Total amenities: {gridAttractors.length}
                    </span>
                    {gridAttractors.length > 0 && (
                      <button
                        className="text-red-500 hover:text-red-700 text-sm underline"
                        onClick={clearGridAttractors}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                </div>

                {/* Right column: Attractivity */}
                <div className="flex-1">
                  <label className="text-base font-medium text-gray-600 block mb-2">
                    Attractivity (Att<sub>j</sub>)
                  </label>
                  <p className="text-xs text-gray-500">Set attractivity on map</p>
                  <span className="text-sm font-semibold mt-1 block" style={{ color: '#d4a800' }}>
                    Total attractivity: {totalGridAttractivity}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex gap-6 mb-6">
              <div className="flex-1">
                <label className="text-base font-medium text-gray-600 block mb-2">
                  Amenity Type (j)
                </label>
                <AmenityDropdown />
              </div>
              <div className="flex-1">
                <label className="text-base font-medium text-gray-600 block mb-2">
                  Attractivity (Att<sub>j</sub>)
                </label>
                <AttractivityDropdown />
              </div>
            </div>
          )}

          {/* Section C: Distance Function */}
          <div>
            <label className="text-base font-medium text-gray-600 block mb-4">
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
  )
}
