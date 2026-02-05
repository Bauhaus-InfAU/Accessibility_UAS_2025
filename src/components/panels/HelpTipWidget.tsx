import { useEffect } from 'react'
import { useAppContext } from '../../context/AppContext'

const HelpIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

export function HelpTipWidget() {
  const { isHelpTipVisible, setIsHelpTipVisible, analysisMode, selectedLandUse, isLoading } = useAppContext()

  // ESC key handler - hide help tip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isHelpTipVisible) {
        setIsHelpTipVisible(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isHelpTipVisible, setIsHelpTipVisible])

  // Don't show during loading
  if (isLoading) return null

  // Tip text based on analysis mode
  const tipText = analysisMode === 'buildings' && selectedLandUse !== 'Custom'
    ? 'Switch to Custom amenity type to add pins'
    : 'Click map to add amenity. Right-click to remove.'

  return (
    <div className="help-tip-widget flex">
      {/* Dismissable Tip (shown to the left of icon) */}
      {isHelpTipVisible && (
        <div className="help-tip-content">
          <p>{tipText}</p>
        </div>
      )}

      {/* Help Icon Button */}
      <button
        onClick={() => setIsHelpTipVisible(!isHelpTipVisible)}
        className={`settings-icon-btn ${isHelpTipVisible ? 'active' : ''}`}
        title="Toggle help tip"
      >
        <HelpIcon />
      </button>
    </div>
  )
}
