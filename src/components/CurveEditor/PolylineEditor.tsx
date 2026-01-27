import { useState, useCallback, useRef, useEffect } from 'react'
import type { ControlPoint } from '../../config/types'
import { toPlotX, toPlotY, fromPlotX, fromPlotY } from './CurveCanvas'

interface PolylineEditorProps {
  points: ControlPoint[]
  onChange: (points: ControlPoint[]) => void
  maxDistance: number
  plotWidth: number
  plotHeight: number
}

// Must match CurveEditor PADDING
const PADDING = { top: 20, right: 20, bottom: 45, left: 60 }

export function PolylineEditor({ points, onChange, maxDistance, plotWidth, plotHeight }: PolylineEditorProps) {
  const [dragging, setDragging] = useState<number | null>(null)
  const svgRef = useRef<SVGGElement>(null)

  // Store current props in refs for use in window event handlers
  const pointsRef = useRef(points)
  const draggingRef = useRef(dragging)
  pointsRef.current = points
  draggingRef.current = dragging

  const getMousePosFromEvent = useCallback((e: MouseEvent | React.MouseEvent): { x: number; y: number } => {
    const svg = svgRef.current?.closest('svg')
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    return {
      x: e.clientX - rect.left - PADDING.left,
      y: e.clientY - rect.top - PADDING.top,
    }
  }, [])

  const handleMouseDown = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(index)
  }, [])

  // Use window-level mouse tracking for drag operations
  useEffect(() => {
    if (dragging === null) return

    const handleWindowMouseMove = (e: MouseEvent) => {
      const currentDragging = draggingRef.current
      if (currentDragging === null) return

      const pos = getMousePosFromEvent(e)
      const sorted = [...pointsRef.current].sort((a, b) => a.x - b.x)

      let newX = fromPlotX(pos.x, maxDistance, plotWidth)
      let newY = fromPlotY(pos.y, plotHeight)

      // Clamp y to [0, 1]
      newY = Math.max(0, Math.min(1, newY))

      // First point: x fixed at 0
      if (currentDragging === 0) {
        newX = 0
      }
      // Last point: x fixed at maxDistance
      else if (currentDragging === sorted.length - 1) {
        newX = maxDistance
      }
      // Middle points: x constrained between neighbors
      else {
        const prevX = sorted[currentDragging - 1].x + 1
        const nextX = sorted[currentDragging + 1].x - 1
        newX = Math.max(prevX, Math.min(nextX, newX))
      }

      // Also clamp x to valid range
      newX = Math.max(0, Math.min(maxDistance, newX))

      const newPoints = sorted.map((p, i) =>
        i === currentDragging ? { x: newX, y: newY } : p
      )
      onChange(newPoints)
    }

    const handleWindowMouseUp = () => {
      setDragging(null)
    }

    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove)
      window.removeEventListener('mouseup', handleWindowMouseUp)
    }
  }, [dragging, maxDistance, plotWidth, plotHeight, onChange, getMousePosFromEvent])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const pos = getMousePosFromEvent(e)
    const newX = fromPlotX(pos.x, maxDistance, plotWidth)
    const newY = fromPlotY(pos.y, plotHeight)

    if (newX < 0 || newX > maxDistance || newY < 0 || newY > 1) return

    const newPoint: ControlPoint = { x: newX, y: Math.max(0, Math.min(1, newY)) }
    const newPoints = [...points, newPoint].sort((a, b) => a.x - b.x)
    onChange(newPoints)
  }, [points, maxDistance, plotWidth, plotHeight, onChange, getMousePosFromEvent])

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
      onDoubleClick={handleDoubleClick}
    >
      {/* Invisible rect for double-click events */}
      <rect width={plotWidth} height={plotHeight} fill="transparent" />

      {/* Line segments */}
      <path d={pathD} fill="none" stroke="#562fae" strokeWidth={3} />

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
            fill="white"
            stroke="#562fae"
            strokeWidth={3}
            cursor="pointer"
            onMouseDown={(e) => handleMouseDown(i, e)}
            onContextMenu={(e) => handleRightClick(i, e)}
          />
        )
      })}
    </g>
  )
}
