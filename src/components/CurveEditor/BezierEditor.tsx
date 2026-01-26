import { useState, useCallback, useRef } from 'react'
import { toPlotX, toPlotY, fromPlotX, fromPlotY } from './CurveCanvas'

interface BezierEditorProps {
  handles: [[number, number], [number, number]] // [[cx1, cy1], [cx2, cy2]]
  onChange: (handles: [[number, number], [number, number]]) => void
  maxDistance: number
  plotWidth: number
  plotHeight: number
}

export function BezierEditor({ handles, onChange, maxDistance, plotWidth, plotHeight }: BezierEditorProps) {
  const [dragging, setDragging] = useState<0 | 1 | null>(null)
  const svgRef = useRef<SVGGElement>(null)

  const getMousePos = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const svg = svgRef.current?.closest('svg')
    if (!svg) return { x: 0, y: 0 }
    const rect = svg.getBoundingClientRect()
    const padding = { left: 45, top: 15 }
    return {
      x: e.clientX - rect.left - padding.left,
      y: e.clientY - rect.top - padding.top,
    }
  }, [])

  const handleMouseDown = useCallback((index: 0 | 1, e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(index)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging === null) return
    const pos = getMousePos(e)
    let newX = fromPlotX(pos.x, maxDistance, plotWidth)
    let newY = fromPlotY(pos.y, plotHeight)

    // Clamp to valid range
    newX = Math.max(0, Math.min(maxDistance, newX))
    newY = Math.max(0, Math.min(1, newY))

    const newHandles: [[number, number], [number, number]] = [...handles] as [[number, number], [number, number]]
    newHandles[dragging] = [newX, newY]
    onChange(newHandles)
  }, [dragging, handles, maxDistance, plotWidth, plotHeight, onChange, getMousePos])

  const handleMouseUp = useCallback(() => {
    setDragging(null)
  }, [])

  // Start and end points
  const startX = toPlotX(0, maxDistance, plotWidth)
  const startY = toPlotY(1, plotHeight)
  const endX = toPlotX(maxDistance, maxDistance, plotWidth)
  const endY = toPlotY(0, plotHeight)

  // Control handle positions
  const h1x = toPlotX(handles[0][0], maxDistance, plotWidth)
  const h1y = toPlotY(handles[0][1], plotHeight)
  const h2x = toPlotX(handles[1][0], maxDistance, plotWidth)
  const h2y = toPlotY(handles[1][1], plotHeight)

  // Bezier path
  const pathD = `M ${startX} ${startY} C ${h1x} ${h1y}, ${h2x} ${h2y}, ${endX} ${endY}`

  return (
    <g
      ref={svgRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Invisible rect for mouse events */}
      <rect width={plotWidth} height={plotHeight} fill="transparent" />

      {/* Bezier curve */}
      <path d={pathD} fill="none" stroke="#2166ac" strokeWidth={2} />

      {/* Handle lines (tangent indicators) */}
      <line x1={startX} y1={startY} x2={h1x} y2={h1y} stroke="#aaa" strokeWidth={1} strokeDasharray="3,3" />
      <line x1={endX} y1={endY} x2={h2x} y2={h2y} stroke="#aaa" strokeWidth={1} strokeDasharray="3,3" />

      {/* Start and end points (fixed) */}
      <circle cx={startX} cy={startY} r={4} fill="#555" stroke="white" strokeWidth={1.5} />
      <circle cx={endX} cy={endY} r={4} fill="#555" stroke="white" strokeWidth={1.5} />

      {/* Draggable control handles */}
      <circle
        cx={h1x}
        cy={h1y}
        r={dragging === 0 ? 7 : 5}
        fill="#e8956a"
        stroke="white"
        strokeWidth={1.5}
        cursor="pointer"
        onMouseDown={(e) => handleMouseDown(0, e)}
      />
      <circle
        cx={h2x}
        cy={h2y}
        r={dragging === 1 ? 7 : 5}
        fill="#e8956a"
        stroke="white"
        strokeWidth={1.5}
        cursor="pointer"
        onMouseDown={(e) => handleMouseDown(1, e)}
      />
    </g>
  )
}
