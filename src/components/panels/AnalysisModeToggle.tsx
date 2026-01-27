import { useAppContext } from '../../context/AppContext'
import type { AnalysisMode } from '../../config/types'

export function AnalysisModeToggle() {
  const { analysisMode, setAnalysisMode, isComputingFullMatrix } = useAppContext()

  const handleModeChange = (mode: AnalysisMode) => {
    setAnalysisMode(mode)
  }

  return (
    <div className="tab-container">
      <button
        className={`tab-button ${analysisMode === 'buildings' ? 'tab-button-active' : ''}`}
        onClick={() => handleModeChange('buildings')}
      >
        Buildings
      </button>
      <button
        className={`tab-button ${analysisMode === 'grid' ? 'tab-button-active' : ''}`}
        onClick={() => handleModeChange('grid')}
        disabled={isComputingFullMatrix}
      >
        {isComputingFullMatrix ? 'Loading...' : 'Grid'}
      </button>
    </div>
  )
}
