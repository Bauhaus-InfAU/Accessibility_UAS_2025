import { useMemo, useState, useCallback, useEffect } from 'react'
import type { ControlPoint, CurveTabMode } from '../../config/types'
import { CurveCanvas, type PlotHoverPosition } from './CurveCanvas'
import { PolylineEditor } from './PolylineEditor'
import { MathCurveDisplay } from './MathCurveDisplay'
import { CoefficientInputs } from './CoefficientInputs'
import { CurveExplorer } from './CurveExplorer'
import { TabContainer } from '../panels/TabContainer'
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

// Grid cells are square: 8 x-intervals (250m each) and 4 y-intervals (0.25 each)
// plotWidth/8 = plotHeight/4 → plotWidth = 2 * plotHeight
const DEFAULT_SVG_WIDTH = 477  // plotWidth = 412, interval = 51.5px
const DEFAULT_SVG_HEIGHT = 260 // plotHeight = 206, interval = 51.5px
const MOBILE_SVG_HEIGHT = 220
const PADDING = { top: 12, right: 15, bottom: 42, left: 50 }

// Hook for responsive SVG dimensions
function useResponsiveDimensions() {
  const [dimensions, setDimensions] = useState({ width: DEFAULT_SVG_WIDTH, height: DEFAULT_SVG_HEIGHT })

  useEffect(() => {
    const updateDimensions = () => {
      if (window.innerWidth < 640) {
        // Mobile: fit within container with padding
        const containerWidth = Math.min(window.innerWidth - 32, 400)
        setDimensions({ width: containerWidth, height: MOBILE_SVG_HEIGHT })
      } else {
        setDimensions({ width: DEFAULT_SVG_WIDTH, height: DEFAULT_SVG_HEIGHT })
      }
    }
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  return dimensions
}

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
  const { width: svgWidth, height: svgHeight } = useResponsiveDimensions()
  const plotWidth = svgWidth - PADDING.left - PADDING.right
  const plotHeight = svgHeight - PADDING.top - PADDING.bottom

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
    <div className="w-full">
      {/* Tabs */}
      <TabContainer
        tabs={TABS}
        activeTab={curveTabMode}
        onTabChange={(id) => onTabModeChange(id as CurveTabMode)}
        className="curve-tabs"
      />

      {/* SVG Canvas */}
      <CurveCanvas
        maxDistance={maxDistance}
        width={svgWidth}
        height={svgHeight}
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
            mode={curveTabMode}
            negExpAlpha={negExpAlpha}
          />
        )}
        {curveTabMode === 'exponentialPower' && (
          <MathCurveDisplay
            evaluator={expPowerEvaluator}
            maxDistance={maxDistance}
            plotWidth={plotWidth}
            plotHeight={plotHeight}
            mode={curveTabMode}
            expPowerB={expPowerB}
            expPowerC={expPowerC}
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
          <div className="flex flex-wrap gap-2">
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
