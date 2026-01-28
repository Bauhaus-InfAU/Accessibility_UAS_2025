import { useAppContext } from '../../context/AppContext'
import { TabContainer } from './TabContainer'
import type { AnalysisMode } from '../../config/types'

const TABS = [
  { id: 'buildings', label: 'Buildings' },
  { id: 'grid', label: 'Grid' },
]

export function AnalysisModeToggle() {
  const { analysisMode, setAnalysisMode, isComputingFullMatrix } = useAppContext()

  const tabs = TABS.map(tab => ({
    ...tab,
    label: tab.id === 'grid' && isComputingFullMatrix ? 'Loading...' : tab.label,
    disabled: tab.id === 'grid' && isComputingFullMatrix,
  }))

  return (
    <TabContainer
      tabs={tabs}
      activeTab={analysisMode}
      onTabChange={(id) => setAnalysisMode(id as AnalysisMode)}
    />
  )
}
