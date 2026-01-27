import { toPlotX, toPlotY } from './CurveCanvas'

interface MathCurveDisplayProps {
  evaluator: (distance: number) => number
  maxDistance: number
  plotWidth: number
  plotHeight: number
  sampleCount?: number
}

/**
 * Renders a mathematical function curve as an SVG polyline.
 * Samples the function at regular intervals and draws a smooth path.
 */
export function MathCurveDisplay({
  evaluator,
  maxDistance,
  plotWidth,
  plotHeight,
  sampleCount = 200,
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

  return (
    <polyline
      points={points.join(' ')}
      fill="none"
      stroke="#562fae"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}
