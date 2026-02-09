import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAppContext } from '../../context/AppContext'

const HelpIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

// Tutorial step configuration
interface TutorialStep {
  id: number
  content: string
  position: 'map' | 'attractor' | 'curve' | 'mode-buildings' | 'mode-grid' | 'mode-surface' | 'explorer' | 'measurement' | 'legend'
  arrow: 'up' | 'down' | 'left' | 'right'
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 0,
    content: 'Click anywhere on the map to add a custom amenity point. Each point influences the accessibility scores of nearby buildings.',
    position: 'map',
    arrow: 'down'
  },
  {
    id: 1,
    content: 'Click the number to change the attractivity value. Higher values mean stronger influence on accessibility.',
    position: 'attractor',
    arrow: 'down'
  },
  {
    id: 2,
    content: 'Customize the distance decay function by dragging points, or explore preset functions. Changes are immediately reflected in the map colors.',
    position: 'curve',
    arrow: 'left'
  },
  {
    id: 3,
    content: 'Buildings mode calculates accessibility for each building based on proximity to amenities. Configure analysis scope and amenity types in the expanded panel.',
    position: 'mode-buildings',
    arrow: 'right'
  },
  {
    id: 4,
    content: 'Grid mode visualizes accessibility on a hexagonal grid, independent of buildings. Useful for comparing areas without building data.',
    position: 'mode-grid',
    arrow: 'right'
  },
  {
    id: 5,
    content: 'Surface mode displays accessibility as a 3D terrain where height represents scores. Great for visualizing accessibility landscapes.',
    position: 'mode-surface',
    arrow: 'right'
  },
  {
    id: 6,
    content: 'Place a flag on the map to explore how the accessibility score is calculated at any point. See paths to all amenities with distance and decay values.',
    position: 'explorer',
    arrow: 'right'
  },
  {
    id: 7,
    content: 'Use the measurement tool to compare network distance vs. straight-line distance between any two points. Click two locations on the map to measure.',
    position: 'measurement',
    arrow: 'right'
  },
  {
    id: 8,
    content: 'Use Adaptive range for auto-scaling or Fixed range to compare scenarios. Drag on the gradient bar to filter and highlight specific score ranges.',
    position: 'legend',
    arrow: 'down'
  },
]

export function HelpTipWidget() {
  const {
    tutorialStep, setTutorialStep, advanceTutorial, skipTutorial, isLoading, gridAttractors,
    setAnalysisMode, setMeasurementActive, setExplorerActive,
    setFilterRangeActive, setFilterRangeMinPercent, setFilterRangeMaxPercent, clearFilterRange,
    isMobileLegendOpen, setIsMobileLegendOpen,
  } = useAppContext()
  const [tipPosition, setTipPosition] = useState({ x: 0, y: 0 })
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)

  // Track if settings panel is expanded for step 3
  const settingsExpandedRef = useRef(false)

  // Track mobile breakpoint
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Calculate position based on current step
  const calculatePosition = useCallback(() => {
    if (tutorialStep === null) return { x: 0, y: 0 }

    const step = TUTORIAL_STEPS[tutorialStep]
    if (!step) return { x: 0, y: 0 }

    // Arrow pointer length (28px line + circle)
    const POINTER_LENGTH = 28
    // Approximate tooltip dimensions for boundary checking
    const TOOLTIP_WIDTH = 300
    const TOOLTIP_HEIGHT = 180

    switch (step.position) {
      case 'map': {
        // Position over the map area (right side of panel area, centered vertically)
        // Account for the panel width on desktop
        const panel = document.querySelector('.glass-panel')
        let mapCenterX = window.innerWidth / 2
        if (panel) {
          const panelRect = panel.getBoundingClientRect()
          // Map center is between panel right edge and window right edge
          mapCenterX = panelRect.right + (window.innerWidth - panelRect.right) / 2
        }
        // Position tooltip above the target point, with arrow pointing down
        return { x: mapCenterX, y: window.innerHeight / 2 - 60 }
      }

      case 'attractor': {
        // Find a visible attractivity box on the map
        const attractorBoxes = document.querySelectorAll('.attractivity-box')
        let targetBox: Element | null = null

        // Find the first box that's within the visible viewport
        for (const box of attractorBoxes) {
          const rect = box.getBoundingClientRect()
          // Check if box is visible on screen (not off-screen)
          if (rect.top > 100 && rect.top < window.innerHeight - 100 &&
              rect.left > 100 && rect.left < window.innerWidth - 100) {
            targetBox = box
            break
          }
        }

        // Use first box if none in ideal position
        if (!targetBox && attractorBoxes.length > 0) {
          targetBox = attractorBoxes[0]
        }

        if (targetBox) {
          const rect = targetBox.getBoundingClientRect()
          // Position tooltip ABOVE the box with arrow pointing DOWN to TOP EDGE of box
          // Don't cover the box so user can still interact with it
          // Arrow length is 28px, tooltip height ~140px
          const tooltipApproxHeight = 140
          // Point to top edge of box (rect.top), with extra offset to not obscure
          return {
            x: rect.left + rect.width / 2,
            y: rect.top - POINTER_LENGTH - tooltipApproxHeight - 30
          }
        }
        // Fallback: center of map if no attractor exists
        const panel = document.querySelector('.glass-panel')
        let mapCenterX = window.innerWidth / 2
        if (panel) {
          const panelRect = panel.getBoundingClientRect()
          mapCenterX = panelRect.right + (window.innerWidth - panelRect.right) / 2
        }
        return { x: mapCenterX, y: window.innerHeight / 2 - 50 }
      }

      case 'curve': {
        // Extended arrow (180px) that goes over the panel and ends inside the plot
        const EXTENDED_ARROW_LENGTH = 180
        const curveSvg = document.querySelector('.curve-tabs + svg') || document.querySelector('.curve-tabs')
        const panel = document.querySelector('.glass-panel')
        if (curveSvg && panel) {
          const svgRect = curveSvg.getBoundingClientRect()
          // Position tooltip so the extended arrow reaches into the plot
          // Arrow extends 180px to the left, ending inside the curve plot
          // Target the middle of the SVG plot area
          const plotCenterX = svgRect.left + svgRect.width / 2
          // Tooltip X should be positioned so arrow end (180px left) lands in the plot
          const targetX = plotCenterX + EXTENDED_ARROW_LENGTH
          const targetY = svgRect.top + svgRect.height / 2 + 20 // Center on the curve

          // Ensure tooltip doesn't go off right edge
          const maxX = window.innerWidth - TOOLTIP_WIDTH / 2 - 20
          return {
            x: Math.min(targetX, maxX),
            y: Math.max(TOOLTIP_HEIGHT / 2 + 20, targetY)
          }
        }
        // Fallback: position to the right with extended arrow reaching left
        const fallbackPanel = document.querySelector('.glass-panel')
        if (fallbackPanel) {
          const rect = fallbackPanel.getBoundingClientRect()
          return { x: rect.right + 150, y: rect.top + 400 }
        }
        return { x: 700, y: 450 }
      }

      case 'mode-buildings': {
        // To the left of the ENTIRE settings widget - first expand the settings panel
        const expandBtn = document.querySelector('.settings-icon-btn.expand-btn')
        const settingsProperties = document.querySelector('.settings-properties')

        // If settings panel isn't expanded, click the expand button
        if (expandBtn && !settingsProperties && !settingsExpandedRef.current) {
          settingsExpandedRef.current = true
          ;(expandBtn as HTMLButtonElement).click()
          // Return a temporary position, will be recalculated after panel expands
          return { x: window.innerWidth - 500, y: window.innerHeight / 2 - 100 }
        }

        // Find the settings widget (includes expanded panel + icons)
        const settingsWidget = document.querySelector('.settings-widget')
        const buildingsBtn = document.querySelector('.settings-icons .settings-icon-btn:first-child')
        if (settingsWidget && buildingsBtn) {
          const widgetRect = settingsWidget.getBoundingClientRect()
          const btnRect = buildingsBtn.getBoundingClientRect()
          // Position tooltip to the LEFT of the entire widget, arrow ends at edge
          return {
            x: widgetRect.left - POINTER_LENGTH,
            y: btnRect.top + btnRect.height / 2
          }
        }
        return { x: window.innerWidth - 500, y: window.innerHeight / 2 - 100 }
      }

      case 'mode-grid': {
        // To the left of the ENTIRE settings widget
        const settingsWidget = document.querySelector('.settings-widget')
        const gridBtn = document.querySelector('.settings-icons .settings-icon-btn:nth-child(2)')
        if (settingsWidget && gridBtn) {
          const widgetRect = settingsWidget.getBoundingClientRect()
          const btnRect = gridBtn.getBoundingClientRect()
          // Position tooltip to the LEFT of the entire widget, arrow ends at edge
          return {
            x: widgetRect.left - POINTER_LENGTH,
            y: btnRect.top + btnRect.height / 2
          }
        }
        return { x: window.innerWidth - 500, y: window.innerHeight / 2 }
      }

      case 'mode-surface': {
        // To the left of the ENTIRE settings widget
        const settingsWidget = document.querySelector('.settings-widget')
        const surfaceBtn = document.querySelector('.settings-icons .settings-icon-btn:nth-child(3)')
        if (settingsWidget && surfaceBtn) {
          const widgetRect = settingsWidget.getBoundingClientRect()
          const btnRect = surfaceBtn.getBoundingClientRect()
          // Position tooltip to the LEFT of the entire widget, arrow ends at edge
          return {
            x: widgetRect.left - POINTER_LENGTH,
            y: btnRect.top + btnRect.height / 2
          }
        }
        return { x: window.innerWidth - 500, y: window.innerHeight / 2 + 50 }
      }

      case 'explorer': {
        // To the left of the explorer button
        const explorerBtn = document.querySelector('.explorer-widget .settings-icon-btn')
        if (explorerBtn) {
          const rect = explorerBtn.getBoundingClientRect()
          return {
            x: rect.left - POINTER_LENGTH - 8,
            y: rect.top + rect.height / 2
          }
        }
        return { x: window.innerWidth - 400, y: window.innerHeight / 2 }
      }

      case 'measurement': {
        // To the left of the entire measurement widget (includes expanded Distance Mode panel)
        const measurementWidget = document.querySelector('.measurement-widget')
        const measureBtn = document.querySelector('.measurement-widget .settings-icon-btn')
        if (measurementWidget && measureBtn) {
          const widgetRect = measurementWidget.getBoundingClientRect()
          const btnRect = measureBtn.getBoundingClientRect()
          return {
            x: widgetRect.left - POINTER_LENGTH,
            y: btnRect.top + btnRect.height / 2
          }
        }
        return { x: window.innerWidth - 400, y: window.innerHeight / 2 }
      }

      case 'legend': {
        // Above the legend gradient bar - find the gradient bar specifically
        const gradientBar = document.querySelector('.legend-gradient-bar')
        if (gradientBar) {
          const rect = gradientBar.getBoundingClientRect()
          // Extended arrow is 120px from tooltip bottom to the gradient bar
          // We want the arrow circle (at the end) to touch the gradient bar top
          // Arrow circle is 10px tall, so aim for center of circle at gradient bar
          const EXTENDED_ARROW_LENGTH = 120

          // The tooltip position (targetY) is where the TOP of the tooltip will be
          // With transform translate(-50%, 0), the tooltip's top-left is at (x - width/2, y)
          // Arrow extends from bottom of tooltip down by 120px
          // So: tooltipTop + tooltipHeight + arrowLength = gradientBar.top (approximately)
          // We need to estimate tooltip height or position so arrow reaches the target

          // Position tooltip so that its bottom + 120px arrow = gradient bar top
          // Use a reference point: we want arrow END at gradient bar
          // tooltipBottom + 120 = rect.top
          // tooltipBottom = rect.top - 120
          // We set tooltip TOP, so we need to subtract tooltip height
          // Actual tooltip is ~260px tall, but we position via top
          const tooltipApproxHeight = 260
          const targetX = rect.left + rect.width / 2
          // Position so arrow end reaches gradient bar top
          const targetY = rect.top - EXTENDED_ARROW_LENGTH - tooltipApproxHeight

          // Ensure Y doesn't go too high (above viewport)
          const minY = 20
          const clampedY = Math.max(minY, targetY)

          // Clamp X to stay within viewport
          const minX = TOOLTIP_WIDTH / 2 + 20
          const maxX = window.innerWidth - TOOLTIP_WIDTH / 2 - 20
          const clampedX = Math.max(minX, Math.min(maxX, targetX))

          return { x: clampedX, y: clampedY }
        }
        // Fallback: bottom right area, but well above bottom edge
        return { x: window.innerWidth - 200, y: window.innerHeight - 400 }
      }

      default:
        return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    }
  }, [tutorialStep])

  // Reset settings expanded ref when leaving mode steps (3, 4, 5)
  useEffect(() => {
    if (tutorialStep === null || tutorialStep < 3 || tutorialStep > 5) {
      settingsExpandedRef.current = false
    }
  }, [tutorialStep])

  // Switch to the appropriate mode and handle tool activation when entering steps
  useEffect(() => {
    if (tutorialStep === null) {
      // Tutorial ended: deactivate tools and clear filter
      setMeasurementActive(false)
      setExplorerActive(false)
      clearFilterRange()
    } else if (tutorialStep === 3) {
      setAnalysisMode('buildings')
    } else if (tutorialStep === 4) {
      setAnalysisMode('grid')
    } else if (tutorialStep === 5) {
      setAnalysisMode('surface')
    } else if (tutorialStep === 6) {
      // Explorer step: collapse settings, switch to buildings, activate explorer
      const collapseBtn = document.querySelector('.settings-icon-btn.expand-btn') as HTMLButtonElement
      const settingsProperties = document.querySelector('.settings-properties')
      if (collapseBtn && settingsProperties) {
        collapseBtn.click()
      }
      setAnalysisMode('buildings')
      setExplorerActive(true)
    } else if (tutorialStep === 7) {
      // Measurement step: deactivate explorer, collapse settings, activate measurement
      setExplorerActive(false)
      const collapseBtn = document.querySelector('.settings-icon-btn.expand-btn') as HTMLButtonElement
      const settingsProperties = document.querySelector('.settings-properties')
      if (collapseBtn && settingsProperties) {
        collapseBtn.click()
      }
      setAnalysisMode('buildings')
      setMeasurementActive(true)
    } else if (tutorialStep === 8) {
      // Legend step: deactivate measurement, set 25-75% filter (keep Adaptive mode)
      setMeasurementActive(false)
      setFilterRangeActive(true)
      setFilterRangeMinPercent(0.25)
      setFilterRangeMaxPercent(0.75)
    }
  }, [tutorialStep, setAnalysisMode, setMeasurementActive, setExplorerActive, setFilterRangeActive, setFilterRangeMinPercent, setFilterRangeMaxPercent, clearFilterRange])

  // Update position on step change and window resize
  useEffect(() => {
    const updatePosition = () => {
      setTipPosition(calculatePosition())
    }

    updatePosition()

    // Add delay for step transitions (e.g., panel expansion)
    const timeoutId = setTimeout(updatePosition, 350)
    // Additional delay for settings panel animation
    const timeoutId2 = setTimeout(updatePosition, 500)

    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('resize', updatePosition)
      clearTimeout(timeoutId)
      clearTimeout(timeoutId2)
    }
  }, [calculatePosition, tutorialStep])

  // Keyboard event handling
  useEffect(() => {
    if (tutorialStep === null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        advanceTutorial()
      } else if (e.key === 'Escape') {
        skipTutorial()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [tutorialStep, advanceTutorial, skipTutorial])

  // Blink animation state (desktop only, on page load)
  const [isBlinking, setIsBlinking] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setIsBlinking(false), 8000) // 2s delay + 6×1s
    return () => clearTimeout(timer)
  }, [])

  // Don't show during loading
  if (isLoading) return null

  const isTutorialActive = tutorialStep !== null
  const currentStep = isTutorialActive ? TUTORIAL_STEPS[tutorialStep] : null

  // Handle icon click
  const handleIconClick = () => {
    if (isMobile) {
      // Mobile: toggle legend visibility
      setIsMobileLegendOpen(!isMobileLegendOpen)
    } else if (isTutorialActive) {
      // Desktop: if tutorial active, terminate it
      skipTutorial()
    } else {
      // Desktop: if tutorial inactive, restart from step 0
      setTutorialStep(0)
    }
  }

  // Get arrow transform class based on direction and step
  const getArrowClass = (arrow: string, stepId: number) => {
    // Use extended left arrow for curve step (step 2) to reach into the plot
    if (stepId === 2 && arrow === 'left') {
      return 'tutorial-arrow-left-extended'
    }
    // Use extended down arrow for legend step (step 7) to reach the gradient bar
    if (stepId === 8 && arrow === 'down') {
      return 'tutorial-arrow-down-extended'
    }
    switch (arrow) {
      case 'up': return 'tutorial-arrow-up'
      case 'down': return 'tutorial-arrow-down'
      case 'left': return 'tutorial-arrow-left'
      case 'right': return 'tutorial-arrow-right'
      default: return ''
    }
  }

  // Get tip transform based on arrow direction
  const getTipTransform = (arrow: string) => {
    switch (arrow) {
      case 'up': return 'translate(-50%, -100%)' // Tip is above target, arrow points up from tip
      case 'down': return 'translate(-50%, 0)' // Tip is below target, arrow points down to target
      case 'left': return 'translate(0, -50%)' // Tip is to the right, arrow points left to target
      case 'right': return 'translate(-100%, -50%)' // Tip is to the left, arrow points right to target
      default: return 'translate(-50%, 0)'
    }
  }

  // For step 1 (attractor), show modified text if no attractors exist
  const getStepContent = (step: TutorialStep) => {
    if (step.id === 1 && gridAttractors.length === 0) {
      return 'First add a point on the map, then click its number to change the attractivity value.'
    }
    return step.content
  }

  // Render tutorial overlay using portal so it's positioned at document root
  const tutorialOverlay = isTutorialActive && currentStep ? createPortal(
    <div
      className="tutorial-overlay"
      style={{
        left: tipPosition.x,
        top: tipPosition.y,
        transform: getTipTransform(currentStep.arrow),
      }}
    >
      <div className="tutorial-tip">
        {/* Arrow indicator */}
        <div className={`tutorial-arrow ${getArrowClass(currentStep.arrow, currentStep.id)}`} />

        {/* Step indicator dots */}
        <div className="tutorial-dots">
          {TUTORIAL_STEPS.map((step) => (
            <div
              key={step.id}
              className={`tutorial-dot ${
                step.id === tutorialStep
                  ? 'active'
                  : step.id < tutorialStep
                  ? 'completed'
                  : ''
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="tutorial-tip-content">
          {getStepContent(currentStep)}
        </div>

        {/* Navigation buttons */}
        <div className="tutorial-tip-actions">
          <button
            className="tutorial-btn tutorial-btn-skip"
            onClick={skipTutorial}
          >
            Skip
          </button>
          <button
            className="tutorial-btn tutorial-btn-next"
            onClick={advanceTutorial}
          >
            {tutorialStep === 8 ? 'Finish' : 'Next'}
            <span className="tutorial-key-hint">&#x21B5;</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      {/* Tutorial Tip Overlay - rendered via portal at document body */}
      {tutorialOverlay}

      {/* Help Icon Button - stays in widget column */}
      <div className="help-tip-widget flex">
        <button
          onClick={handleIconClick}
          className={`settings-icon-btn ${isMobile ? (isMobileLegendOpen ? 'active' : '') : (isTutorialActive ? 'active' : '')}${isBlinking && !(isMobile ? isMobileLegendOpen : isTutorialActive) ? ' help-btn-blink' : ''}`}
          title={isMobile ? (isMobileLegendOpen ? 'Hide legend' : 'Show legend') : (isTutorialActive ? 'End tutorial' : 'Start tutorial')}
        >
          <HelpIcon />
        </button>
      </div>
    </>
  )
}
