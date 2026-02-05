import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppContext } from '../../context/AppContext'
import { CurveEditor, type CurveHoverValues } from '../CurveEditor/CurveEditor'

// SVG Icons for expand/collapse
const PanelExpandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const PanelCollapseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 15 12 9 18 15" />
  </svg>
)

// Decay curve icon (matches favicon style)
const DecayCurveIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    {/* Decay curve - exponential power style */}
    <path
      d="M2,2 C12,2 8,22 22,22"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
    />
    {/* Small axis indicators */}
    <circle cx="2" cy="2" r="1.5" fill="currentColor" />
    <circle cx="22" cy="22" r="1.5" fill="currentColor" />
  </svg>
)

// Minimum panel height in pixels
const MIN_PANEL_HEIGHT = 150

export function ParametersPanel() {
  const {
    isPanelCollapsed,
    setIsPanelCollapsed,
    panelHeight,
    setPanelHeight,
    curveTabMode,
    polylinePoints,
    maxDistance,
    negExpAlpha,
    expPowerB,
    expPowerC,
    setCurveTabMode,
    setPolylinePoints,
    setNegExpAlpha,
    setExpPowerB,
    setExpPowerC,
    isLoading,
  } = useAppContext()

  // Resize drag state
  const [isDragging, setIsDragging] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef<number>(0)
  const startHeightRef = useRef<number>(0)

  // Hover values from curve editor
  const [hoverValues, setHoverValues] = useState<CurveHoverValues | null>(null)
  const handleHoverChange = useCallback((values: CurveHoverValues | null) => {
    setHoverValues(values)
  }, [])

  // Handle resize drag with window-level event listeners
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      const deltaY = e.clientY - startYRef.current
      // Calculate max height based on viewport (same as CSS max-height)
      const isMobile = window.innerWidth < 640
      const maxHeight = window.innerHeight - (isMobile ? 92 : 76)
      const newHeight = Math.max(MIN_PANEL_HEIGHT, Math.min(maxHeight, startHeightRef.current + deltaY))
      setPanelHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    // Touch support
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0]
        const deltaY = touch.clientY - startYRef.current
        const isMobile = window.innerWidth < 640
        const maxHeight = window.innerHeight - (isMobile ? 92 : 76)
        const newHeight = Math.max(MIN_PANEL_HEIGHT, Math.min(maxHeight, startHeightRef.current + deltaY))
        setPanelHeight(newHeight)
      }
    }

    const handleTouchEnd = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isDragging, setPanelHeight])

  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    startYRef.current = clientY
    // Get current panel height
    if (panelRef.current) {
      startHeightRef.current = panelRef.current.getBoundingClientRect().height
    }
    setIsDragging(true)
  }

  if (isLoading) return null

  // Dynamic width: auto when collapsed, fixed when expanded
  const panelWidth = isPanelCollapsed ? 'sm:w-auto' : 'sm:w-[580px]'

  return (
    <div
      ref={panelRef}
      className={`absolute top-0 left-0 right-0 sm:top-5 sm:left-5 sm:right-auto glass-panel floating-panel py-2 px-2 sm:py-2 sm:px-2 w-full ${panelWidth} rounded-none sm:rounded-2xl max-h-[calc(100vh-92px)] sm:max-h-[calc(100vh-76px)] flex flex-col overflow-x-hidden`}
      style={{
        height: panelHeight && !isPanelCollapsed ? `${panelHeight}px` : undefined,
      }}
    >
      {/* Title - clickable to collapse/expand */}
      <button
        className="w-full flex items-center justify-between text-left flex-shrink-0"
        onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
      >
        <h2 className="panel-title">
          <span className="panel-title-icon">
            <DecayCurveIcon />
          </span>
          <span>Accessibility Analysis</span>
        </h2>
        <span className="w-6 h-6 flex items-center justify-center text-gray-500">
          {isPanelCollapsed ? <PanelExpandIcon /> : <PanelCollapseIcon />}
        </span>
      </button>

      {/* Divider between header and content */}
      {!isPanelCollapsed && (
        <div className="panel-divider" />
      )}

      {/* Scrollable content area */}
      <div className="overflow-y-auto flex-1 min-h-0 panel-content">
        {/* Collapsible content */}
        {!isPanelCollapsed && (
          <>
            {/* Introduction and Master Equation */}
            <p className="text-xs sm:text-sm text-gray-600 mt-2 sm:mt-3 mb-2">
              Explore how distance affects accessibility.
              For each location <span className="math-var">i</span>, we sum the attractivity <span className="math-var">Att<sub>j</sub></span> of every
              amenity <span className="math-var">j</span>, weighted by how much the <span className="equation-accent">distance <span className="math-var" style={{ color: 'inherit' }}>d<sub>ij</sub></span></span> reduces
              its influence via the <span className="equation-accent">decay function <span className="math-var" style={{ color: 'inherit' }}>f(d<sub>ij</sub>)</span></span>.
            </p>
            <div className="equation equation-grey text-center mb-4 flex items-center justify-center gap-1">
              <span>Acc<sub>i</sub> =</span>
              <span className="inline-flex flex-col items-center mx-1" style={{ fontSize: '0.65em', lineHeight: 1 }}>
                <span>N</span>
                <span style={{ fontSize: '1.8em', lineHeight: 0.9 }}>Σ</span>
                <span>j=1</span>
              </span>
              <span>[Att<sub>j</sub> × </span>
              <span className="equation-accent">
                {hoverValues
                  ? hoverValues.fValue.toFixed(2)
                  : <>f(d<sub>ij</sub>)</>
                }
              </span>
              <span>]</span>
            </div>

            <p className="text-xs sm:text-sm text-gray-600 mb-6">
              Explore how different <span className="equation-accent">distance decay functions <span className="math-var" style={{ color: 'inherit' }}>f(d<sub>ij</sub>)</span></span> affect the accessibility analysis.
              The shape of the function represents how the utility of an amenity decreases with growing distance.
            </p>

            {/* Distance Decay Function */}
            <div>
              <CurveEditor
                curveTabMode={curveTabMode}
                polylinePoints={polylinePoints}
                maxDistance={maxDistance}
                negExpAlpha={negExpAlpha}
                expPowerB={expPowerB}
                expPowerC={expPowerC}
                onTabModeChange={setCurveTabMode}
                onPolylineChange={setPolylinePoints}
                onNegExpAlphaChange={setNegExpAlpha}
                onExpPowerBChange={setExpPowerB}
                onExpPowerCChange={setExpPowerC}
                onHoverChange={handleHoverChange}
              />
            </div>
          </>
        )}
      </div>

      {/* Resize handle at bottom - only shown when not collapsed */}
      {!isPanelCollapsed && (
        <div
          className="resize-handle flex-shrink-0"
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
        >
          <div className="resize-handle-grip" />
        </div>
      )}
    </div>
  )
}
