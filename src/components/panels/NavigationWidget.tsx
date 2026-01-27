import { useMapContext } from '../../context/MapContext'

// SVG Icons as inline components
const TopViewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="12" y1="3" x2="12" y2="21"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
  </svg>
)

const PerspectiveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
    <path d="M2 17l10 5 10-5"/>
    <path d="M2 12l10 5 10-5"/>
  </svg>
)

const ResetIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
  </svg>
)

export function NavigationWidget() {
  const { zoomIn, zoomOut, setTopView, setPerspective, resetView, activeView } = useMapContext()

  return (
    <div className="absolute top-5 right-5 glass-panel floating-panel p-2 flex gap-2">
      {/* View buttons */}
      <div className="flex flex-col gap-1">
        <button
          onClick={setTopView}
          className={`nav-btn text-sm ${activeView === 'top' ? 'nav-btn-active' : ''}`}
          title="Top view (2D)"
        >
          <TopViewIcon />
          <span className="ml-2">Top View</span>
        </button>
        <button
          onClick={setPerspective}
          className={`nav-btn text-sm ${activeView === 'perspective' ? 'nav-btn-active' : ''}`}
          title="Perspective view (3D)"
        >
          <PerspectiveIcon />
          <span className="ml-2">Perspective</span>
        </button>
        <button
          onClick={resetView}
          className="nav-btn text-sm"
          title="Reset to initial view"
        >
          <ResetIcon />
          <span className="ml-2">Reset</span>
        </button>
      </div>

      {/* Zoom controls */}
      <div className="flex flex-col gap-1 border-l border-gray-200 pl-2">
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
          -
        </button>
      </div>
    </div>
  )
}
