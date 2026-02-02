import { useAppContext } from '../../context/AppContext'
import { TabContainer } from './TabContainer'
import type { AnalysisMode } from '../../config/types'

const TABS = [
  { id: 'buildings', label: 'Building Analysis' },
  { id: 'grid', label: 'Grid Analysis' },
  { id: 'surface', label: 'Surface Analysis' },
]

export function AnalysisModeToggle() {
  const { analysisMode, setAnalysisMode } = useAppContext()

  return (
    <TabContainer
      tabs={TABS}
      activeTab={analysisMode}
      onTabChange={(id) => setAnalysisMode(id as AnalysisMode)}
    />
  )
}
