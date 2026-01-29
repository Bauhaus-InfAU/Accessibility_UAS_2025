import { toPlotX, toPlotY } from './CurveCanvas'
import type { CurveTabMode } from '../../config/types'

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

  // Style for coefficient values
  const coefficientStyle: React.CSSProperties = {
    color: '#e85d04',
    fontWeight: 600,
  }

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
          color: '#5633ac'
        }}>
          {mode === 'negativeExponential' && (
            <span>
              f(d<sub>ij</sub>) = e<sup>-<span style={coefficientStyle}>{negExpAlpha}</span>·d<sub>ij</sub></sup>
            </span>
          )}
          {mode === 'exponentialPower' && (
            <span>
              f(d<sub>ij</sub>) = e<sup>-(d<sub>ij</sub>/<span style={coefficientStyle}>{expPowerB}</span>)<sup><span style={coefficientStyle}>{expPowerC}</span></sup></sup>
            </span>
          )}
        </div>
      </foreignObject>
    </g>
  )
}
