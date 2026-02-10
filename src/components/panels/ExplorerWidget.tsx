import { useEffect } from 'react'
import { useAppContext } from '../../context/AppContext'

// Flag icon (triangular flag on post)
const FlagIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="4" x2="5" y2="21" />
    <path d="M5 4l14 4-14 4" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />
  </svg>
)

export function ExplorerWidget() {
  const {
    isExplorerActive,
    setExplorerActive,
  } = useAppContext()

  // ESC key handler - deactivate explorer tool
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExplorerActive) {
        setExplorerActive(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isExplorerActive, setExplorerActive])

  return (
    <div className={`explorer-widget flex ${isExplorerActive ? 'expanded' : ''}`}>
      {/* Expanded panel when explorer active */}
      {isExplorerActive && (
        <div className="explorer-properties">
          <h3 className="panel-title">Explore</h3>
          <div className="settings-divider" />
          <p className="text-[11px] text-gray-500">Click on the map to inspect how a location's accessibility score is calculated.</p>
        </div>
      )}
      {/* Toggle button */}
      <div className={isExplorerActive ? 'explorer-icon-column' : ''}>
        <button
          onClick={() => setExplorerActive(!isExplorerActive)}
          className={`settings-icon-btn ${isExplorerActive ? 'active' : ''}`}
          title={isExplorerActive ? 'Disable accessibility explorer' : 'Enable accessibility explorer'}
        >
          <FlagIcon />
        </button>
      </div>
    </div>
  )
}
