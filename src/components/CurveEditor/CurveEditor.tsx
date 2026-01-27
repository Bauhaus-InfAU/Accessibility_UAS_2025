import type { ControlPoint } from '../../config/types'
import { DEFAULT_POLYLINE_POINTS } from '../../config/constants'
import { CurveCanvas } from './CurveCanvas'
import { PolylineEditor } from './PolylineEditor'

interface CurveEditorProps {
  polylinePoints: ControlPoint[]
  maxDistance: number
  onPolylineChange: (points: ControlPoint[]) => void
}

const SVG_WIDTH = 620
const SVG_HEIGHT = 360
const PADDING = { top: 20, right: 20, bottom: 45, left: 60 }

export function CurveEditor({
  polylinePoints,
  maxDistance,
  onPolylineChange,
}: CurveEditorProps) {
  const plotWidth = SVG_WIDTH - PADDING.left - PADDING.right
  const plotHeight = SVG_HEIGHT - PADDING.top - PADDING.bottom

  const setExponential = () => {
    onPolylineChange([...DEFAULT_POLYLINE_POINTS])
  }

  const setConstant = () => {
    onPolylineChange([
      { x: 0, y: 1 },
      { x: maxDistance, y: 1 },
    ])
  }

  const setLinear = () => {
    onPolylineChange([
      { x: 0, y: 1 },
      { x: maxDistance, y: 0 },
    ])
  }

  const setSteep = () => {
    onPolylineChange([
      { x: 0, y: 1 },
      { x: 200, y: 0.5 },
      { x: 500, y: 0.1 },
      { x: maxDistance, y: 0 },
    ])
  }

  const setStep = () => {
    onPolylineChange([
      { x: 0, y: 1 },
      { x: 499, y: 1 },
      { x: 500, y: 0 },
      { x: maxDistance, y: 0 },
    ])
  }

  return (
    <div>
      {/* SVG Canvas */}
      <CurveCanvas
        maxDistance={maxDistance}
        width={SVG_WIDTH}
        height={SVG_HEIGHT}
        padding={PADDING}
      >
        <PolylineEditor
          points={polylinePoints}
          onChange={onPolylineChange}
          maxDistance={maxDistance}
          plotWidth={plotWidth}
          plotHeight={plotHeight}
        />
      </CurveCanvas>

      {/* Presets */}
      <div className="flex gap-2 mt-4">
        <button className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200" onClick={setConstant}>
          Constant
        </button>
        <button className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200" onClick={setLinear}>
          Linear
        </button>
        <button className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200" onClick={setExponential}>
          Exponential
        </button>
        <button className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200" onClick={setSteep}>
          Steep
        </button>
        <button className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200" onClick={setStep}>
          Step (500m)
        </button>
      </div>

      {/* Instructions */}
      <p className="text-sm text-gray-400 mt-3">
        Double-click to add point. Right-click to remove.
      </p>
    </div>
  )
}
