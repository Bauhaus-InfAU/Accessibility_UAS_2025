import { useMemo, useState, useCallback } from 'react'
import type { ControlPoint, CurveTabMode } from '../../config/types'
import { CurveCanvas, type PlotHoverPosition } from './CurveCanvas'
import { PolylineEditor } from './PolylineEditor'
import { MathCurveDisplay } from './MathCurveDisplay'
import { CoefficientInputs } from './CoefficientInputs'
import { CurveExplorer } from './CurveExplorer'
import { createNegativeExponentialEvaluator, createExponentialPowerEvaluator, createPolylineEvaluator } from '../../computation/curveEvaluator'

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

  // Hover state for curve explorer
  const [hoverPlotX, setHoverPlotX] = useState<number | null>(null)

  const handlePlotHover = useCallback((position: PlotHoverPosition | null) => {
    setHoverPlotX(position?.plotX ?? null)
  }, [])

  // Create evaluators for mathematical functions
  const negExpEvaluator = useMemo(
    () => createNegativeExponentialEvaluator(negExpAlpha),
    [negExpAlpha]
  )
  const expPowerEvaluator = useMemo(
    () => createExponentialPowerEvaluator(expPowerB, expPowerC),
    [expPowerB, expPowerC]
  )

  // Unified evaluator for the current mode (used by CurveExplorer)
  const currentEvaluator = useMemo(() => {
    switch (curveTabMode) {
      case 'negativeExponential':
        return negExpEvaluator
      case 'exponentialPower':
        return expPowerEvaluator
      case 'custom':
      default:
        return createPolylineEvaluator(polylinePoints)
    }
  }, [curveTabMode, negExpEvaluator, expPowerEvaluator, polylinePoints])

  // Preset functions for custom mode
  // Approximates negative exponential f(d) = e^(-0.003*d)
  const setExponential = () => {
    onPolylineChange([
      { x: 0, y: 1 },
      { x: 250, y: 0.472 },
      { x: 500, y: 0.223 },
      { x: 750, y: 0.105 },
      { x: 1000, y: 0.050 },
      { x: 1500, y: 0.011 },
      { x: maxDistance, y: 0.002 },
    ])
  }

  // Approximates exponential power f(d) = e^(-(d/700)^2)
  const setPower = () => {
    onPolylineChange([
      { x: 0, y: 1 },
      { x: 250, y: 0.880 },
      { x: 500, y: 0.600 },
      { x: 750, y: 0.317 },
      { x: 1000, y: 0.130 },
      { x: 1500, y: 0.010 },
      { x: maxDistance, y: 0 },
    ])
  }

  const setLinear = () => {
    onPolylineChange([
      { x: 0, y: 1 },
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

  const setConstant = () => {
    onPolylineChange([
      { x: 0, y: 1 },
      { x: maxDistance, y: 1 },
    ])
  }

  return (
    <div>
      {/* Tabs */}
      <div className="tab-container">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${curveTabMode === tab.id ? 'tab-button-active' : ''}`}
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
        onPlotHover={handlePlotHover}
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

        {/* Interactive curve explorer overlay */}
        <CurveExplorer
          evaluator={currentEvaluator}
          maxDistance={maxDistance}
          plotWidth={plotWidth}
          plotHeight={plotHeight}
          hoverPlotX={hoverPlotX}
        />
      </CurveCanvas>

      {/* Tab-specific controls */}
      {curveTabMode === 'custom' && (
        <>
          {/* Presets */}
          <p className="text-sm text-gray-500 mt-4 mb-2">Presets:</p>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200" onClick={setExponential}>
              Exponential
            </button>
            <button className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200" onClick={setPower}>
              Power
            </button>
            <button className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200" onClick={setLinear}>
              Linear
            </button>
            <button className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200" onClick={setStep}>
              Step
            </button>
            <button className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200" onClick={setConstant}>
              Constant
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
