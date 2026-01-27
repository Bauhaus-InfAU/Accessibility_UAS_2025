import { useAppContext } from '../../context/AppContext'
import { CurveEditor } from '../CurveEditor/CurveEditor'
import { AmenityDropdown } from './AmenityDropdown'
import { AttractivityDropdown } from './AttractivityDropdown'

export function ParametersPanel() {
  const {
    curveMode,
    polylinePoints,
    bezierHandles,
    maxDistance,
    setCurveMode,
    setPolylinePoints,
    setBezierHandles,
    isLoading,
  } = useAppContext()

  if (isLoading) return null

  return (
    <div className="absolute top-5 left-5 glass-panel floating-panel p-4 w-[340px]">
      {/* Header */}
      <h2 className="text-sm font-semibold text-gray-800 mb-4">
        Accessibility Parameters
      </h2>

      {/* Dropdowns row */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-500 block mb-1">
            Amenity
          </label>
          <AmenityDropdown />
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-gray-500 block mb-1">
            Attractivity
          </label>
          <AttractivityDropdown />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 my-4" />

      {/* Curve Editor Section */}
      <CurveEditor
        mode={curveMode}
        polylinePoints={polylinePoints}
        bezierHandles={bezierHandles}
        maxDistance={maxDistance}
        onModeChange={setCurveMode}
        onPolylineChange={setPolylinePoints}
        onBezierChange={setBezierHandles}
      />

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-200 text-[9px] text-gray-400">
        <p>Acc_i = Sum Att_j x f(d_ij)</p>
      </div>
    </div>
  )
}
