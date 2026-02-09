import type { ExplorerResult } from '../../config/types'
import { toPlotX, toPlotY } from './CurveCanvas'

interface ExplorerDotsProps {
  results: ExplorerResult[]
  maxDistance: number
  plotWidth: number
  plotHeight: number
  hoveredAmenityId: string | null
}

/**
 * Renders colored dots on the curve plot at (d_ij, f(d_ij)) for each explorer result,
 * with dashed crosshair lines to axes and colored value labels.
 * Uses two-pass rendering: non-hovered first, then hovered last (SVG z-order).
 */
export function ExplorerDots({ results, maxDistance, plotWidth, plotHeight, hoveredAmenityId }: ExplorerDotsProps) {
  const hasHover = hoveredAmenityId !== null

  // Split into two passes for z-ordering
  const nonHovered = hasHover ? results.filter(r => r.amenityId !== hoveredAmenityId) : results
  const hovered = hasHover ? results.filter(r => r.amenityId === hoveredAmenityId) : []

  const renderResult = (r: ExplorerResult, isHovered: boolean) => {
    const cx = toPlotX(r.networkDistance, maxDistance, plotWidth)
    const cy = toPlotY(r.decayValue, plotHeight)

    // Skip dots outside plot bounds
    if (cx < 0 || cx > plotWidth || cy < 0 || cy > plotHeight) return null

    const dotRadius = isHovered ? 7 : 5
    const strokeWidth = isHovered ? 2.5 : 1.5
    const crosshairOpacity = isHovered ? 1.0 : 0.5
    const dimOpacity = hasHover && !isHovered ? 0.3 : 1

    return (
      <g key={r.amenityId} opacity={dimOpacity}>
        {/* Vertical dashed line from dot down to x-axis */}
        <line
          x1={cx}
          y1={cy}
          x2={cx}
          y2={plotHeight}
          stroke={r.color}
          strokeWidth={1}
          strokeDasharray="3,3"
          opacity={crosshairOpacity}
        />

        {/* Horizontal dashed line from dot left to y-axis */}
        <line
          x1={0}
          y1={cy}
          x2={cx}
          y2={cy}
          stroke={r.color}
          strokeWidth={1}
          strokeDasharray="3,3"
          opacity={crosshairOpacity}
        />

        {/* X-axis value label (distance) — matches CurveExplorer style */}
        <g transform={`translate(${cx}, ${plotHeight + 5})`}>
          <rect x={-25} y={0} width={50} height={18} rx={4} fill={r.color} />
          <text x={0} y={13} textAnchor="middle" fill="white" fontSize={11} fontWeight={500}>
            {Math.round(r.networkDistance)}
          </text>
        </g>

        {/* Y-axis value label (decay value) — matches CurveExplorer style */}
        <g transform={`translate(-5, ${cy})`}>
          <rect x={-45} y={-9} width={40} height={18} rx={4} fill={r.color} />
          <text x={-25} y={5} textAnchor="middle" fill="white" fontSize={11} fontWeight={500}>
            {r.decayValue.toFixed(2)}
          </text>
        </g>

        {/* Dot */}
        <circle
          cx={cx}
          cy={cy}
          r={dotRadius}
          fill={r.color}
          stroke="white"
          strokeWidth={strokeWidth}
        />
      </g>
    )
  }

  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* Pass 1: non-hovered (rendered first = behind) */}
      {nonHovered.map(r => renderResult(r, false))}
      {/* Pass 2: hovered (rendered last = on top) */}
      {hovered.map(r => renderResult(r, true))}
    </g>
  )
}
