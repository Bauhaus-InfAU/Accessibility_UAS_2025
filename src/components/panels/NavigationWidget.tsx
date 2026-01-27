import { useMapContext } from '../../context/MapContext'

export function NavigationWidget() {
  const { zoomIn, zoomOut, setTopView, setPerspective, resetView } = useMapContext()

  return (
    <div className="absolute top-5 right-5 glass-panel floating-panel p-2 flex gap-2">
      {/* View buttons */}
      <div className="flex flex-col gap-1">
        <button
          onClick={setTopView}
          className="nav-btn text-xs"
          title="Top view (2D)"
        >
          Top View
        </button>
        <button
          onClick={setPerspective}
          className="nav-btn text-xs"
          title="Perspective view (3D)"
        >
          Perspective
        </button>
        <button
          onClick={resetView}
          className="nav-btn text-xs"
          title="Reset to initial view"
        >
          Reset
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
