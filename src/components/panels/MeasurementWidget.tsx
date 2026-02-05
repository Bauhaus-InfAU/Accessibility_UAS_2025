import { useEffect } from 'react'
import { useAppContext } from '../../context/AppContext'

// Ruler icon
const RulerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21.17 8l-4.24-4.24a2 2 0 0 0-2.83 0L2.83 15.03a2 2 0 0 0 0 2.83L7.07 22.1a2 2 0 0 0 2.83 0L21.17 10.83a2 2 0 0 0 0-2.83z"/>
    <line x1="15" y1="5" x2="17" y2="7"/>
    <line x1="11" y1="9" x2="13" y2="11"/>
    <line x1="7" y1="13" x2="9" y2="15"/>
  </svg>
)

export function MeasurementWidget() {
  const {
    isMeasurementActive,
    setMeasurementActive,
  } = useAppContext()

  // ESC key handler - deactivate measurement tool
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMeasurementActive) {
        setMeasurementActive(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMeasurementActive, setMeasurementActive])

  return (
    <div className="measurement-widget flex">
      {/* Toggle button */}
      <button
        onClick={() => setMeasurementActive(!isMeasurementActive)}
        className={`settings-icon-btn ${isMeasurementActive ? 'active' : ''}`}
        title={isMeasurementActive ? 'Disable measurement' : 'Enable measurement'}
      >
        <RulerIcon />
      </button>
    </div>
  )
}
