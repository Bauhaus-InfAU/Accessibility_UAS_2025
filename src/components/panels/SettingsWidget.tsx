import { useState, useEffect } from 'react'
import { useAppContext } from '../../context/AppContext'
import { AmenityDropdown } from './AmenityDropdown'
import { AttractivityDropdown } from './AttractivityDropdown'
import { PillToggle } from './PillToggle'
import { HexSizeSlider } from './HexSizeSlider'
import { ParameterSlider } from './ParameterSlider'
import type { BuildingFilterMode, AnalysisMode } from '../../config/types'
import {
  TERRAIN_SMOOTH_MIN,
  TERRAIN_SMOOTH_MAX,
  TERRAIN_SMOOTH_STEP,
  TERRAIN_HEIGHT_MIN,
  TERRAIN_HEIGHT_MAX,
  TERRAIN_HEIGHT_STEP,
} from '../../config/constants'

// SVG Icons for mode buttons
const BuildingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 12 L12 4 L20 12 V21 H4 Z" />
  </svg>
)

const GridIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {/* Vertical lines */}
    <line x1="8" y1="3" x2="8" y2="21" />
    <line x1="16" y1="3" x2="16" y2="21" />
    {/* Horizontal lines */}
    <line x1="3" y1="8" x2="21" y2="8" />
    <line x1="3" y1="16" x2="21" y2="16" />
  </svg>
)

const SurfaceIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {/* Mountain/terrain shape */}
    <path d="M3 20 L8 10 L12 14 L17 6 L21 20 Z" />
  </svg>
)

const ExpandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6" />
  </svg>
)

const CollapseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

interface ModeButtonProps {
  mode: AnalysisMode
  currentMode: AnalysisMode
  onClick: () => void
  icon: React.ReactNode
  title: string
}

function ModeButton({ mode, currentMode, onClick, icon, title }: ModeButtonProps) {
  const isActive = mode === currentMode
  return (
    <button
      onClick={onClick}
      className={`settings-icon-btn ${isActive ? 'active' : ''}`}
      title={title}
    >
      {icon}
    </button>
  )
}

export function SettingsWidget() {
  const [isExpanded, setIsExpanded] = useState(false)
  const {
    analysisMode,
    setAnalysisMode,
    buildingFilterMode,
    setBuildingFilterMode,
    gridAttractors,
    clearGridAttractors,
    totalGridAttractivity,
    hexDiameter,
    setHexDiameter,
    isRegeneratingGrid,
    terrainSmoothing,
    setTerrainSmoothing,
    terrainHeightScale,
    setTerrainHeightScale,
  } = useAppContext()

  const isBuildingsMode = analysisMode === 'buildings'
  const isGridMode = analysisMode === 'grid'
  const isSurfaceMode = analysisMode === 'surface'

  // ESC key handler - collapse settings panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded])

  return (
    <div className="settings-widget">
      {/* Expanded properties panel (left side) */}
      {isExpanded && (
        <div className="settings-properties">
          {/* Title */}
          <h3 className="panel-title">
            {isBuildingsMode && "Buildings"}
            {isGridMode && "Grid"}
            {isSurfaceMode && "Surface"}
          </h3>

          {/* Divider */}
          <div className="settings-divider" />

          {/* Buildings mode properties */}
          {isBuildingsMode && (
            <div className="settings-section">
              {/* Analysis Scope */}
              <div className="mb-3">
                <label className="settings-label">
                  Analysis Scope (<span className="math-var">i</span>)
                </label>
                <div className="settings-content">
                  <PillToggle
                    options={[
                      { value: 'residential', label: 'Residential' },
                      { value: 'all', label: 'All Buildings' },
                    ]}
                    value={buildingFilterMode}
                    onChange={(v) => setBuildingFilterMode(v as BuildingFilterMode)}
                  />
                </div>
              </div>

              {/* Amenity Type */}
              <div className="mb-3">
                <label className="settings-label">
                  Amenity Type (<span className="math-var">j</span>)
                </label>
                <div className="settings-content">
                  <AmenityDropdown />
                </div>
              </div>

              {/* Attractivity */}
              <div>
                <label className="settings-label">
                  Attractivity (<span className="math-var">Att<sub>j</sub></span>)
                </label>
                <div className="settings-content">
                  <AttractivityDropdown />
                </div>
              </div>
            </div>
          )}

          {/* Grid mode properties */}
          {isGridMode && (
            <div className="settings-section">
              {/* Hexagon Size */}
              <div className="mb-3">
                <HexSizeSlider
                  value={hexDiameter}
                  onChange={setHexDiameter}
                  disabled={isRegeneratingGrid}
                  label={isRegeneratingGrid ? "Hexagon Size (updating...)" : "Hexagon Size"}
                />
              </div>

              {/* Custom Amenities */}
              <div>
                <label className="settings-label">
                  Custom Amenities (<span className="math-var">j</span>)
                </label>
                <div className="settings-content">
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm" style={{ color: '#5631ad' }}>
                      Total: {gridAttractors.length}
                    </span>
                    {gridAttractors.length > 0 && (
                      <button
                        className="text-black hover:text-gray-700 text-xs underline"
                        onClick={clearGridAttractors}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="mt-2">
                    <span className="text-sm" style={{ color: '#5631ad' }}>
                      Attractivity: {totalGridAttractivity}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Surface mode properties */}
          {isSurfaceMode && (
            <div className="settings-section">
              {/* Terrain Smoothing */}
              <div className="mb-3">
                <ParameterSlider
                  value={terrainSmoothing}
                  onChange={setTerrainSmoothing}
                  min={TERRAIN_SMOOTH_MIN}
                  max={TERRAIN_SMOOTH_MAX}
                  step={TERRAIN_SMOOTH_STEP}
                  label="Terrain Smoothing"
                  decimals={1}
                />
              </div>

              {/* Terrain Height */}
              <div className="mb-3">
                <ParameterSlider
                  value={terrainHeightScale}
                  onChange={setTerrainHeightScale}
                  min={TERRAIN_HEIGHT_MIN}
                  max={TERRAIN_HEIGHT_MAX}
                  step={TERRAIN_HEIGHT_STEP}
                  label="Terrain Height"
                  unit="m"
                />
              </div>

              {/* Custom Amenities */}
              <div>
                <label className="settings-label">
                  Custom Amenities (<span className="math-var">j</span>)
                </label>
                <div className="settings-content">
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm" style={{ color: '#5631ad' }}>
                      Total: {gridAttractors.length}
                    </span>
                    {gridAttractors.length > 0 && (
                      <button
                        className="text-black hover:text-gray-700 text-xs underline"
                        onClick={clearGridAttractors}
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="mt-2">
                    <span className="text-sm" style={{ color: '#5631ad' }}>
                      Attractivity: {totalGridAttractivity}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Icon column (right side) */}
      <div className="settings-icons">
        <ModeButton
          mode="buildings"
          currentMode={analysisMode}
          onClick={() => {
            if (analysisMode === 'buildings') {
              setIsExpanded(!isExpanded)
            } else {
              setAnalysisMode('buildings')
            }
          }}
          icon={<BuildingsIcon />}
          title="Building Analysis"
        />
        <ModeButton
          mode="grid"
          currentMode={analysisMode}
          onClick={() => {
            if (analysisMode === 'grid') {
              setIsExpanded(!isExpanded)
            } else {
              setAnalysisMode('grid')
            }
          }}
          icon={<GridIcon />}
          title="Grid Analysis"
        />
        <ModeButton
          mode="surface"
          currentMode={analysisMode}
          onClick={() => {
            if (analysisMode === 'surface') {
              setIsExpanded(!isExpanded)
            } else {
              setAnalysisMode('surface')
            }
          }}
          icon={<SurfaceIcon />}
          title="Surface Analysis"
        />

        {/* Divider */}
        <div className="settings-divider" />

        {/* Expand/Collapse button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="settings-icon-btn expand-btn"
          title={isExpanded ? "Collapse settings" : "Expand settings"}
        >
          {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
        </button>
      </div>
    </div>
  )
}
