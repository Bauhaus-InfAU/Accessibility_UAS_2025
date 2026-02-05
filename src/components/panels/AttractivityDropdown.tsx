import { useAppContext } from '../../context/AppContext'
import type { AttractivityMode } from '../../config/types'
import { PillDropdown } from './PillDropdown'

const MODES: { value: AttractivityMode; label: string }[] = [
  { value: 'floorArea', label: 'Floor Area' },
  { value: 'volume', label: 'Volume' },
  { value: 'count', label: 'Count (=1)' },
]

export function AttractivityDropdown() {
  const { attractivityMode, setAttractivityMode, selectedLandUse, totalGridAttractivity } = useAppContext()
  const isCustomMode = selectedLandUse === 'Custom'

  // In custom mode, show instruction and total instead of dropdown
  if (isCustomMode) {
    return (
      <div className="flex flex-col">
        <p className="instruction-text">Set attractivity on map</p>
        <span className="text-sm mt-1" style={{ color: '#5631ad' }}>
          Total attractivity: {totalGridAttractivity}
        </span>
      </div>
    )
  }

  return (
    <PillDropdown
      options={MODES}
      value={attractivityMode}
      onChange={(value) => setAttractivityMode(value as AttractivityMode)}
    />
  )
}
