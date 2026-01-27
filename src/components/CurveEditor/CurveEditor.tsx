import { useMemo } from 'react'
import type { ControlPoint, CurveTabMode } from '../../config/types'
import { DEFAULT_POLYLINE_POINTS } from '../../config/constants'
import { CurveCanvas } from './CurveCanvas'
import { PolylineEditor } from './PolylineEditor'
import { MathCurveDisplay } from './MathCurveDisplay'
import { CoefficientInputs } from './CoefficientInputs'
import { createNegativeExponentialEvaluator, createExponentialPowerEvaluator } from '../../computation/curveEvaluator'

interface CurveEditorProps {
  curveTabMode: CurveTabMode
  polylinePoints: ControlPoint[]
  maxDistance: number
  negExpAlpha: number
  expPowerB: number
  expPowerC: number
  onTabModeChange: (mode: CurveTabMode) => void
  onPolylineChange: (points: ControlPoint[]) => void
  onNegExpAlphaChange: (alpha: number) => void
  onExpPowerBChange: (b: number) => void
  onExpPowerCChange: (c: number) => void
}

const SVG_WIDTH = 620
const SVG_HEIGHT = 360
const PADDING = { top: 20, right: 20, bottom: 45, left: 60 }

const TABS: { id: CurveTabMode; label: string }[] = [
  { id: 'custom', label: 'Custom' },
  { id: 'negativeExponential', label: 'Negative Exponential' },
  { id: 'exponentialPower', label: 'Exponential Power' },
]

export function CurveEditor({
  curveTabMode,
  polylinePoints,
  maxDistance,
  negExpAlpha,
  expPowerB,
  expPowerC,
  onTabModeChange,
  onPolylineChange,
  onNegExpAlphaChange,
  onExpPowerBChange,
  onExpPowerCChange,
}: CurveEditorProps) {
  const plotWidth = SVG_WIDTH - PADDING.left - PADDING.right
  const plotHeight = SVG_HEIGHT - PADDING.top - PADDING.bottom

  // Create evaluators for mathematical functions
  const negExpEvaluator = useMemo(
    () => createNegativeExponentialEvaluator(negExpAlpha),
    [negExpAlpha]
  )
  const expPowerEvaluator = useMemo(
    () => createExponentialPowerEvaluator(expPowerB, expPowerC),
    [expPowerB, expPowerC]
  )

  // Preset functions for custom mode
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
      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              curveTabMode === tab.id
                ? 'text-purple-700 border-b-2 border-purple-700 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => onTabModeChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SVG Canvas */}
      <CurveCanvas
        maxDistance={maxDistance}
        width={SVG_WIDTH}
        height={SVG_HEIGHT}
        padding={PADDING}
      >
        {curveTabMode === 'custom' && (
          <PolylineEditor
            points={polylinePoints}
            onChange={onPolylineChange}
            maxDistance={maxDistance}
            plotWidth={plotWidth}
            plotHeight={plotHeight}
          />
        )}
        {curveTabMode === 'negativeExponential' && (
          <MathCurveDisplay
            evaluator={negExpEvaluator}
            maxDistance={maxDistance}
            plotWidth={plotWidth}
            plotHeight={plotHeight}
          />
        )}
        {curveTabMode === 'exponentialPower' && (
          <MathCurveDisplay
            evaluator={expPowerEvaluator}
            maxDistance={maxDistance}
            plotWidth={plotWidth}
            plotHeight={plotHeight}
          />
        )}
      </CurveCanvas>

      {/* Tab-specific controls */}
      {curveTabMode === 'custom' && (
        <>
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
        </>
      )}

      {/* Coefficient inputs for mathematical modes */}
      {(curveTabMode === 'negativeExponential' || curveTabMode === 'exponentialPower') && (
        <CoefficientInputs
          mode={curveTabMode}
          negExpAlpha={negExpAlpha}
          expPowerB={expPowerB}
          expPowerC={expPowerC}
          onNegExpAlphaChange={onNegExpAlphaChange}
          onExpPowerBChange={onExpPowerBChange}
          onExpPowerCChange={onExpPowerCChange}
        />
      )}
    </div>
  )
}
