import { useEffect, useState, useCallback } from 'react'
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
  position: 'map' | 'attractor' | 'panel' | 'modes' | 'legend'
  arrow: 'up' | 'down' | 'left' | 'right'
}

const TUTORIAL_STEPS: TutorialStep[] = [
  { id: 0, content: 'Click on the map to add an amenity point', position: 'map', arrow: 'down' },
  { id: 1, content: 'Click the number to change the attractivity value', position: 'attractor', arrow: 'down' },
  { id: 2, content: 'Adjust the distance decay function to control how distance affects accessibility', position: 'panel', arrow: 'left' },
  { id: 3, content: 'Switch between Buildings, Grid, and Surface analysis modes', position: 'modes', arrow: 'right' },
  { id: 4, content: 'Drag on the gradient to filter scores. Toggle between Adaptive and Fixed range', position: 'legend', arrow: 'up' },
]

export function HelpTipWidget() {
  const { tutorialStep, setTutorialStep, advanceTutorial, skipTutorial, isLoading, gridAttractors } = useAppContext()
  const [tipPosition, setTipPosition] = useState({ x: 0, y: 0 })

  // Calculate position based on current step
  const calculatePosition = useCallback(() => {
    if (tutorialStep === null) return { x: 0, y: 0 }

    const step = TUTORIAL_STEPS[tutorialStep]
    if (!step) return { x: 0, y: 0 }

    switch (step.position) {
      case 'map': {
        // Center of map, tip above with arrow pointing down
        return { x: window.innerWidth / 2, y: window.innerHeight / 2 - 100 }
      }

      case 'attractor': {
        // Above first attractor marker
        const attractor = document.querySelector('.attractivity-box')
        if (attractor) {
          const rect = attractor.getBoundingClientRect()
          return { x: rect.left + rect.width / 2, y: rect.top - 80 }
        }
        // Fallback: center of map if no attractor exists
        return { x: window.innerWidth / 2, y: window.innerHeight / 2 - 50 }
      }

      case 'panel': {
        // Right of panel
        const panel = document.querySelector('.glass-panel')
        if (panel) {
          const rect = panel.getBoundingClientRect()
          return { x: rect.right + 20, y: Math.max(100, rect.top + 100) }
        }
        return { x: 350, y: 200 }
      }

      case 'modes': {
        // Left of mode buttons (SettingsWidget)
        const settings = document.querySelector('.settings-icons')
        if (settings) {
          const rect = settings.getBoundingClientRect()
          return { x: rect.left - 20, y: rect.top + rect.height / 2 }
        }
        return { x: window.innerWidth - 400, y: window.innerHeight / 2 }
      }

      case 'legend': {
        // Above legend
        const legend = document.querySelector('.legend-container')
        if (legend) {
          const rect = legend.getBoundingClientRect()
          return { x: rect.left + rect.width / 2, y: rect.top - 20 }
        }
        return { x: window.innerWidth - 200, y: window.innerHeight - 200 }
      }

      default:
        return { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    }
  }, [tutorialStep])

  // Update position on step change and window resize
  useEffect(() => {
    const updatePosition = () => {
      setTipPosition(calculatePosition())
    }

    updatePosition()

    // Add delay for step transitions (e.g., panel expansion)
    const timeoutId = setTimeout(updatePosition, 350)

    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('resize', updatePosition)
      clearTimeout(timeoutId)
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

  // Don't show during loading
  if (isLoading) return null

  const isTutorialActive = tutorialStep !== null
  const currentStep = isTutorialActive ? TUTORIAL_STEPS[tutorialStep] : null

  // Handle icon click
  const handleIconClick = () => {
    if (isTutorialActive) {
      // If tutorial active, terminate it
      skipTutorial()
    } else {
      // If tutorial inactive, restart from step 0
      setTutorialStep(0)
    }
  }

  // Get arrow transform class based on direction
  const getArrowClass = (arrow: string) => {
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
      return 'Add a point first, then click its number to change the attractivity value'
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
        <div className={`tutorial-arrow ${getArrowClass(currentStep.arrow)}`} />

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
            {tutorialStep === 4 ? 'Finish' : 'Next'}
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
          className={`settings-icon-btn ${isTutorialActive ? 'active' : ''}`}
          title={isTutorialActive ? 'End tutorial' : 'Start tutorial'}
        >
          <HelpIcon />
        </button>
      </div>
    </>
  )
}
