import { toPlotX, toPlotY, fromPlotX } from './CurveCanvas'

interface CurveExplorerProps {
  evaluator: (distance: number) => number
  maxDistance: number
  plotWidth: number
  plotHeight: number
  hoverPlotX: number | null  // null when not hovering
}

export function CurveExplorer({ evaluator, maxDistance, plotWidth, plotHeight, hoverPlotX }: CurveExplorerProps) {
  // Calculate hover state from plotX
  const hoverState = hoverPlotX !== null ? (() => {
    const distance = fromPlotX(hoverPlotX, maxDistance, plotWidth)
    // Clamp distance to valid range
    const clampedDistance = Math.max(0, Math.min(maxDistance, distance))
    const fValue = evaluator(clampedDistance)
    const plotX = toPlotX(clampedDistance, maxDistance, plotWidth)
    const plotY = toPlotY(fValue, plotHeight)
    return { distance: clampedDistance, fValue, plotX, plotY }
  })() : null

  if (!hoverState) return null

  return (
    <g className="curve-explorer" style={{ pointerEvents: 'none' }}>
      {/* Vertical dashed line */}
      <line
        x1={hoverState.plotX}
        y1={0}
        x2={hoverState.plotX}
        y2={plotHeight}
        stroke="#562fae"
        strokeWidth={1}
        strokeDasharray="4,4"
        opacity={0.6}
      />

      {/* Horizontal dashed line */}
      <line
        x1={0}
        y1={hoverState.plotY}
        x2={hoverState.plotX}
        y2={hoverState.plotY}
        stroke="#562fae"
        strokeWidth={1}
        strokeDasharray="4,4"
        opacity={0.6}
      />

      {/* Intersection point */}
      <circle
        cx={hoverState.plotX}
        cy={hoverState.plotY}
        r={4}
        fill="#562fae"
      />

      {/* X-axis value label */}
      <g transform={`translate(${hoverState.plotX}, ${plotHeight + 5})`}>
        <rect x={-25} y={0} width={50} height={18} rx={4} fill="#562fae" />
        <text x={0} y={13} textAnchor="middle" fill="white" fontSize={11} fontWeight={500}>
          {Math.round(hoverState.distance)}
        </text>
      </g>

      {/* Y-axis value label */}
      <g transform={`translate(-5, ${hoverState.plotY})`}>
        <rect x={-45} y={-9} width={40} height={18} rx={4} fill="#562fae" />
        <text x={-25} y={5} textAnchor="middle" fill="white" fontSize={11} fontWeight={500}>
          {hoverState.fValue.toFixed(2)}
        </text>
      </g>
    </g>
  )
}
