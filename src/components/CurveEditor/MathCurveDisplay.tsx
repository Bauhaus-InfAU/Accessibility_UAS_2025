import { toPlotX, toPlotY } from './CurveCanvas'
import type { CurveTabMode } from '../../config/types'
import type { CurveHoverValues } from './CurveEditor'
import type { CoefficientHoverType } from './CoefficientInputs'

interface MathCurveDisplayProps {
  evaluator: (distance: number) => number
  maxDistance: number
  plotWidth: number
  plotHeight: number
  sampleCount?: number
  mode: CurveTabMode
  negExpAlpha?: number
  expPowerB?: number
  expPowerC?: number
  hoverValues?: CurveHoverValues | null
  hoveredCoefficient?: CoefficientHoverType
}

/**
 * Renders a mathematical function curve as an SVG polyline.
 * Samples the function at regular intervals and draws a smooth path.
 * Also displays the equation in the top-right corner of the plot.
 */
export function MathCurveDisplay({
  evaluator,
  maxDistance,
  plotWidth,
  plotHeight,
  sampleCount = 200,
  mode,
  negExpAlpha,
  expPowerB,
  expPowerC,
  hoverValues,
  hoveredCoefficient,
}: MathCurveDisplayProps) {
  // Generate sample points
  const points: string[] = []
  for (let i = 0; i <= sampleCount; i++) {
    const distance = (i / sampleCount) * maxDistance
    const value = evaluator(distance)
    const x = toPlotX(distance, maxDistance, plotWidth)
    const y = toPlotY(Math.max(0, Math.min(1, value)), plotHeight)
    points.push(`${x},${y}`)
  }

  // Position for equation (top-right with padding)
  const equationY = 12

  // Style for coefficient values (user-defined parameters) - same as base grey
  const coefficientStyle: React.CSSProperties = {
    fontWeight: 600,
  }

  // Style for highlighted coefficient (when hovering input field) - accent color
  const coefficientHighlightStyle: React.CSSProperties = {
    color: '#5631ad',
    fontWeight: 600,
  }

  // Style for substituted values (computed from hover) - accent color
  const substitutedStyle: React.CSSProperties = {
    color: '#5631ad',
    fontWeight: 600,
  }

  // Determine which coefficients are highlighted
  const isAlphaHighlighted = hoveredCoefficient === 'alpha'
  const isBHighlighted = hoveredCoefficient === 'b'
  const isCHighlighted = hoveredCoefficient === 'c'

  const alphaStyle = isAlphaHighlighted ? coefficientHighlightStyle : coefficientStyle
  const bStyle = isBHighlighted ? coefficientHighlightStyle : coefficientStyle
  const cStyle = isCHighlighted ? coefficientHighlightStyle : coefficientStyle

  return (
    <g>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="#562fae"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Equation display in top-right corner */}
      <foreignObject x={0} y={equationY} width={plotWidth} height={50}>
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          paddingRight: '20px',
          fontFamily: 'Times New Roman, serif',
          fontSize: '22px',
          fontStyle: 'italic',
          color: '#6b7280'
        }}>
          {mode === 'negativeExponential' && (
            <span>
              {hoverValues ? (
                <>
                  <span style={substitutedStyle}>{hoverValues.fValue.toFixed(2)}</span>
                  {' = e'}
                  <sup>-<span style={alphaStyle}>{negExpAlpha}</span>·<span style={substitutedStyle}>{Math.round(hoverValues.distance)}</span></sup>
                </>
              ) : (
                <>f(d<sub>ij</sub>) = e<sup>-<span style={alphaStyle}>{negExpAlpha}</span>·d<sub>ij</sub></sup></>
              )}
            </span>
          )}
          {mode === 'exponentialPower' && (
            <span>
              {hoverValues ? (
                <>
                  <span style={substitutedStyle}>{hoverValues.fValue.toFixed(2)}</span>
                  {' = e'}
                  <sup>-(<span style={substitutedStyle}>{Math.round(hoverValues.distance)}</span>/<span style={bStyle}>{expPowerB}</span>)<sup><span style={cStyle}>{expPowerC}</span></sup></sup>
                </>
              ) : (
                <>f(d<sub>ij</sub>) = e<sup>-(d<sub>ij</sub>/<span style={bStyle}>{expPowerB}</span>)<sup><span style={cStyle}>{expPowerC}</span></sup></sup></>
              )}
            </span>
          )}
        </div>
      </foreignObject>
    </g>
  )
}
