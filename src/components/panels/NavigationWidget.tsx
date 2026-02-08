import { useMapContext } from '../../context/MapContext'
import { useAppContext } from '../../context/AppContext'

// SVG Icons as inline components
const TopViewIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="12" y1="3" x2="12" y2="21"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
  </svg>
)

const PerspectiveIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {/* Isometric box - top face */}
    <path d="M12 2 L22 7 L12 12 L2 7 Z" />
    {/* Vertical edges */}
    <line x1="2" y1="7" x2="2" y2="17" />
    <line x1="22" y1="7" x2="22" y2="17" />
    <line x1="12" y1="12" x2="12" y2="22" />
    {/* Bottom edges */}
    <line x1="2" y1="17" x2="12" y2="22" />
    <line x1="22" y1="17" x2="12" y2="22" />
  </svg>
)

const ResetIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
  </svg>
)

const CompassIcon = ({ bearing }: { bearing: number }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    style={{ transform: `rotate(${-bearing}deg)`, transition: 'transform 0.1s ease-out' }}
  >
    <path d="M12 1 L17.5 17 L12 14 L6.5 17 Z" fill="currentColor" />
  </svg>
)

export function NavigationWidget() {
  const { zoomIn, zoomOut, setTopView, setPerspective, resetView, activeView, bearing, resetNorth } = useMapContext()
  const { isPanelCollapsed } = useAppContext()

  // On mobile: hidden when panel is open, top-left below collapsed panel when collapsed
  // On desktop: always top-right
  const mobileVisibility = isPanelCollapsed ? '' : 'hidden sm:flex'

  return (
    <div className={`absolute top-14 left-4 sm:top-5 sm:left-auto sm:right-5 p-2 flex gap-2 pointer-events-auto z-10 ${mobileVisibility}`}>
      {/* View buttons */}
      <div className="flex flex-col gap-1">
        <button
          onClick={setTopView}
          className={`nav-btn nav-btn-icon ${activeView === 'top' ? 'nav-btn-active' : ''}`}
          title="Top view (2D)"
        >
          <TopViewIcon />
        </button>
        <button
          onClick={setPerspective}
          className={`nav-btn nav-btn-icon ${activeView === 'perspective' ? 'nav-btn-active' : ''}`}
          title="Perspective view (3D)"
        >
          <PerspectiveIcon />
        </button>
        <button
          onClick={resetView}
          className="nav-btn nav-btn-icon"
          title="Reset to initial view"
        >
          <ResetIcon />
        </button>
      </div>

      {/* Zoom controls + compass */}
      <div className="flex flex-col gap-1 border-l border-white/30 pl-2">
        <button
          onClick={zoomIn}
          className="nav-btn nav-btn-icon"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="nav-btn nav-btn-icon"
          title="Zoom out"
        >
          −
        </button>
        <div className="border-t border-white/30 pt-1">
          <button
            onClick={resetNorth}
            className="nav-btn nav-btn-icon"
            title="Reset north"
          >
            <CompassIcon bearing={bearing} />
          </button>
        </div>
      </div>
    </div>
  )
}
