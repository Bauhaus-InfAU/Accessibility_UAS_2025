import { useState, useCallback, useRef } from 'react'
import type { ControlPoint } from '../../config/types'
import { toPlotX, toPlotY, fromPlotX, fromPlotY } from './CurveCanvas'

interface PolylineEditorProps {
  points: ControlPoint[]
  onChange: (points: ControlPoint[]) => void
  maxDistance: number
  plotWidth: number
  plotHeight: number
}

export function PolylineEditor({ points, onChange, maxDistance, plotWidth, plotHeight }: PolylineEditorProps) {
  const [dragging, setDragging] = useState<number | null>(null)
  const svgRef = useRef<SVGGElement>(null)

  const getMousePos = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const svg = svgRef.current?.closest('svg')
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    const padding = { left: 45, top: 15 } // must match CurveEditor padding
    return {
      x: e.clientX - rect.left - padding.left,
      y: e.clientY - rect.top - padding.top,
    }
  }, [])

  const handleMouseDown = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault()
    // First and last points are fixed on x-axis
    setDragging(index)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging === null) return
    const pos = getMousePos(e)
    const sorted = [...points].sort((a, b) => a.x - b.x)

    let newX = fromPlotX(pos.x, maxDistance, plotWidth)
    let newY = fromPlotY(pos.y, plotHeight)

    // Clamp y to [0, 1]
    newY = Math.max(0, Math.min(1, newY))

    // First point: x fixed at 0
    if (dragging === 0) {
      newX = 0
    }
    // Last point: x fixed at maxDistance
    else if (dragging === sorted.length - 1) {
      newX = maxDistance
    }
    // Middle points: x constrained between neighbors
    else {
      const prevX = sorted[dragging - 1].x + 1
      const nextX = sorted[dragging + 1].x - 1
      newX = Math.max(prevX, Math.min(nextX, newX))
    }

    const newPoints = sorted.map((p, i) =>
      i === dragging ? { x: newX, y: newY } : p
    )
    onChange(newPoints)
  }, [dragging, points, maxDistance, plotWidth, plotHeight, onChange, getMousePos])

  const handleMouseUp = useCallback(() => {
    setDragging(null)
  }, [])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const pos = getMousePos(e)
    const newX = fromPlotX(pos.x, maxDistance, plotWidth)
    const newY = fromPlotY(pos.y, plotHeight)

    if (newX < 0 || newX > maxDistance || newY < 0 || newY > 1) return

    const newPoint: ControlPoint = { x: newX, y: Math.max(0, Math.min(1, newY)) }
    const newPoints = [...points, newPoint].sort((a, b) => a.x - b.x)
    onChange(newPoints)
  }, [points, maxDistance, plotWidth, plotHeight, onChange, getMousePos])

  const handleRightClick = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault()
    const sorted = [...points].sort((a, b) => a.x - b.x)
    // Don't remove first or last point
    if (index === 0 || index === sorted.length - 1) return
    if (sorted.length <= 2) return

    const newPoints = sorted.filter((_, i) => i !== index)
    onChange(newPoints)
  }, [points, onChange])

  const sorted = [...points].sort((a, b) => a.x - b.x)

  // Build polyline path
  const pathD = sorted
    .map((p, i) => {
      const px = toPlotX(p.x, maxDistance, plotWidth)
      const py = toPlotY(p.y, plotHeight)
      return i === 0 ? `M ${px} ${py}` : `L ${px} ${py}`
    })
    .join(' ')

  return (
    <g
      ref={svgRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      {/* Invisible rect for mouse events */}
      <rect width={plotWidth} height={plotHeight} fill="transparent" />

      {/* Line segments */}
      <path d={pathD} fill="none" stroke="#2166ac" strokeWidth={2} />

      {/* Control points */}
      {sorted.map((p, i) => {
        const px = toPlotX(p.x, maxDistance, plotWidth)
        const py = toPlotY(p.y, plotHeight)
        return (
          <circle
            key={i}
            cx={px}
            cy={py}
            r={dragging === i ? 7 : 5}
            fill={i === 0 || i === sorted.length - 1 ? '#555' : '#2166ac'}
            stroke="white"
            strokeWidth={1.5}
            cursor="pointer"
            onMouseDown={(e) => handleMouseDown(i, e)}
            onContextMenu={(e) => handleRightClick(i, e)}
          />
        )
      })}
    </g>
  )
}
