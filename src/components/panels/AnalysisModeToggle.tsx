import { useAppContext } from '../../context/AppContext'
import type { AnalysisMode } from '../../config/types'

export function AnalysisModeToggle() {
  const { analysisMode, setAnalysisMode, isComputingFullMatrix } = useAppContext()

  const handleModeChange = (mode: AnalysisMode) => {
    setAnalysisMode(mode)
  }

  return (
    <div className="flex gap-2 mb-4">
      <button
        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          analysisMode === 'buildings'
            ? 'bg-purple-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        onClick={() => handleModeChange('buildings')}
      >
        Buildings
      </button>
      <button
        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          analysisMode === 'grid'
            ? 'bg-purple-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        onClick={() => handleModeChange('grid')}
        disabled={isComputingFullMatrix}
      >
        {isComputingFullMatrix ? 'Loading...' : 'Grid'}
      </button>
    </div>
  )
}
