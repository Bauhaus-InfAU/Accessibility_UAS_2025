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
    isPanelCollapsed,
    isMeasurementActive,
    setMeasurementActive,
  } = useAppContext()

  // On mobile: hidden when panel is open, positioned above navigation widget when collapsed
  // On desktop: always visible, below navigation widget
  const mobileVisibility = isPanelCollapsed ? '' : 'hidden sm:flex'

  return (
    <div className={`absolute bottom-20 right-4 sm:top-[140px] sm:bottom-auto sm:right-5 flex flex-col items-end gap-2 pointer-events-auto z-10 ${mobileVisibility}`}>
      {/* Toggle button */}
      <button
        onClick={() => setMeasurementActive(!isMeasurementActive)}
        className={`nav-btn nav-btn-icon ${isMeasurementActive ? 'nav-btn-active' : ''}`}
        title={isMeasurementActive ? 'Disable measurement' : 'Enable measurement'}
      >
        <RulerIcon />
      </button>
    </div>
  )
}
