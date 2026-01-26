import { useAppContext } from '../../context/AppContext'
import { CurveEditor } from '../CurveEditor/CurveEditor'
import { AmenitySelector } from './AmenitySelector'
import { AttractivityMode } from './AttractivityMode'
import { Legend } from './Legend'

export function ControlPanel() {
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
    <div className="w-[350px] h-full overflow-y-auto border-r border-gray-200 bg-white p-4 flex flex-col gap-4">
      <h1 className="text-sm font-bold text-gray-800">Distance Decay Builder</h1>

      <CurveEditor
        mode={curveMode}
        polylinePoints={polylinePoints}
        bezierHandles={bezierHandles}
        maxDistance={maxDistance}
        onModeChange={setCurveMode}
        onPolylineChange={setPolylinePoints}
        onBezierChange={setBezierHandles}
      />

      <hr className="border-gray-200" />

      <AmenitySelector />

      <hr className="border-gray-200" />

      <AttractivityMode />

      <hr className="border-gray-200" />

      <Legend />

      <div className="mt-auto pt-4 text-[9px] text-gray-400">
        <p>Acc_i = Σ Att_j × f(d_ij)</p>
        <p className="mt-1">Data: Weimar city center</p>
      </div>
    </div>
  )
}
