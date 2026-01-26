import type { ControlPoint, CurveMode } from '../../config/types'
import { DEFAULT_POLYLINE_POINTS, DEFAULT_BEZIER_HANDLES } from '../../config/constants'
import { CurveCanvas } from './CurveCanvas'
import { PolylineEditor } from './PolylineEditor'
import { BezierEditor } from './BezierEditor'

interface CurveEditorProps {
  mode: CurveMode
  polylinePoints: ControlPoint[]
  bezierHandles: [[number, number], [number, number]]
  maxDistance: number
  onModeChange: (mode: CurveMode) => void
  onPolylineChange: (points: ControlPoint[]) => void
  onBezierChange: (handles: [[number, number], [number, number]]) => void
}

const SVG_WIDTH = 310
const SVG_HEIGHT = 200
const PADDING = { top: 15, right: 15, bottom: 30, left: 45 }

export function CurveEditor({
  mode,
  polylinePoints,
  bezierHandles,
  maxDistance,
  onModeChange,
  onPolylineChange,
  onBezierChange,
}: CurveEditorProps) {
  const plotWidth = SVG_WIDTH - PADDING.left - PADDING.right
  const plotHeight = SVG_HEIGHT - PADDING.top - PADDING.bottom

  const resetToDefault = () => {
    onPolylineChange([...DEFAULT_POLYLINE_POINTS])
    onBezierChange([...DEFAULT_BEZIER_HANDLES])
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
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-gray-600">Distance Decay Function</span>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 mb-2">
        <button
          className={`px-2 py-1 text-xs rounded ${mode === 'polyline' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          onClick={() => onModeChange('polyline')}
        >
          Polyline
        </button>
        <button
          className={`px-2 py-1 text-xs rounded ${mode === 'bezier' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          onClick={() => onModeChange('bezier')}
        >
          Bezier
        </button>
      </div>

      {/* SVG Canvas */}
      <CurveCanvas
        maxDistance={maxDistance}
        width={SVG_WIDTH}
        height={SVG_HEIGHT}
        padding={PADDING}
      >
        {mode === 'polyline' ? (
          <PolylineEditor
            points={polylinePoints}
            onChange={onPolylineChange}
            maxDistance={maxDistance}
            plotWidth={plotWidth}
            plotHeight={plotHeight}
          />
        ) : (
          <BezierEditor
            handles={bezierHandles}
            onChange={onBezierChange}
            maxDistance={maxDistance}
            plotWidth={plotWidth}
            plotHeight={plotHeight}
          />
        )}
      </CurveCanvas>

      {/* Presets */}
      <div className="flex gap-1 mt-2">
        <button className="px-2 py-0.5 text-[10px] bg-gray-100 rounded hover:bg-gray-200" onClick={resetToDefault}>
          Exponential
        </button>
        <button className="px-2 py-0.5 text-[10px] bg-gray-100 rounded hover:bg-gray-200" onClick={setLinear}>
          Linear
        </button>
        <button className="px-2 py-0.5 text-[10px] bg-gray-100 rounded hover:bg-gray-200" onClick={setSteep}>
          Steep
        </button>
        <button className="px-2 py-0.5 text-[10px] bg-gray-100 rounded hover:bg-gray-200" onClick={setStep}>
          Step (500m)
        </button>
      </div>

      {/* Instructions */}
      {mode === 'polyline' && (
        <p className="text-[10px] text-gray-400 mt-1">
          Double-click to add point. Right-click to remove.
        </p>
      )}
    </div>
  )
}
