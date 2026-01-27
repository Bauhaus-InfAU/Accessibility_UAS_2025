import { type ReactNode } from 'react'

interface CurveCanvasProps {
  maxDistance: number
  width: number
  height: number
  padding: { top: number; right: number; bottom: number; left: number }
  children: ReactNode
}

export function CurveCanvas({ maxDistance, width, height, padding, children }: CurveCanvasProps) {
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  // Grid lines
  const xTicks = [0, 250, 500, 750, 1000, 1250, 1500, 1750, 2000].filter(v => v <= maxDistance)
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0]

  return (
    <svg width={width} height={height} className="select-none">

      {/* Grid lines */}
      {xTicks.map(val => {
        const x = padding.left + (val / maxDistance) * plotWidth
        return (
          <g key={`x-${val}`}>
            <line x1={x} y1={padding.top} x2={x} y2={padding.top + plotHeight} stroke="white" strokeWidth={1} />
            <text x={x} y={padding.top + plotHeight + 18} textAnchor="middle" fontSize={13} fill="#888">
              {val}
            </text>
          </g>
        )
      })}
      {yTicks.map(val => {
        const y = padding.top + (1 - val) * plotHeight
        return (
          <g key={`y-${val}`}>
            <line x1={padding.left} y1={y} x2={padding.left + plotWidth} y2={y} stroke="white" strokeWidth={1} />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize={13} fill="#888">
              {val.toFixed(2)}
            </text>
          </g>
        )
      })}


      {/* Axis labels */}
      <text x={padding.left + plotWidth / 2} y={height - 8} textAnchor="middle" fontSize={14} fill="#555">
        <tspan>Distance (m) → </tspan>
        <tspan fontStyle="italic">d</tspan>
        <tspan fontSize={10} dy={3}>ij</tspan>
      </text>
      <text
        x={18}
        y={padding.top + plotHeight / 2}
        textAnchor="middle"
        fontSize={14}
        fill="#555"
        transform={`rotate(-90, 18, ${padding.top + plotHeight / 2})`}
      >
        <tspan>Willingness to Travel → </tspan>
        <tspan fontStyle="italic">f</tspan>
        <tspan>(</tspan>
        <tspan fontStyle="italic">d</tspan>
        <tspan fontSize={10} dy={3}>ij</tspan>
        <tspan dy={-3}>)</tspan>
      </text>

      {/* Plot area content */}
      <g transform={`translate(${padding.left}, ${padding.top})`}>
        {children}
      </g>
    </svg>
  )
}

// Helper: convert data coordinates to plot coordinates
export function toPlotX(x: number, maxDistance: number, plotWidth: number): number {
  return (x / maxDistance) * plotWidth
}

export function toPlotY(y: number, plotHeight: number): number {
  return (1 - y) * plotHeight
}

export function fromPlotX(px: number, maxDistance: number, plotWidth: number): number {
  return (px / plotWidth) * maxDistance
}

export function fromPlotY(py: number, plotHeight: number): number {
  return 1 - py / plotHeight
}
