import { useState } from 'react'
import { useAppContext } from '../../context/AppContext'
import { CurveEditor } from '../CurveEditor/CurveEditor'
import { AmenityDropdown } from './AmenityDropdown'
import { AttractivityDropdown } from './AttractivityDropdown'

export function ParametersPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const {
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
  } = useAppContext()

  if (isLoading) return null

  return (
    <div className="absolute top-5 left-5 glass-panel floating-panel p-6 w-[680px]">
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
          {/* Section A: Introduction and Master Equation */}
          <p className="text-sm text-gray-600 mb-3">
            Accessibility measures how well a location is served by nearby amenities.
            For each location <i>i</i>, we sum the attractivity <strong>Att<sub>j</sub></strong> of every
            amenity <i>j</i>, weighted by how much the distance <strong>d<sub>ij</sub></strong> reduces
            its influence via the decay function <strong>f(d<sub>ij</sub>)</strong>.
          </p>
          <div className="equation text-center mb-6">
            Acc<sub>i</sub> = Σ Att<sub>j</sub> × f(d<sub>ij</sub>)
          </div>

          {/* Section B: Parameters */}
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

          {/* Divider */}
          <div className="border-t border-gray-200 my-6" />

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
