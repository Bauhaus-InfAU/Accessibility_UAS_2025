import { useAppContext } from '../../context/AppContext'
import type { AttractivityMode } from '../../config/types'

const MODES: { value: AttractivityMode; label: string }[] = [
  { value: 'floorArea', label: 'Floor Area' },
  { value: 'volume', label: 'Volume' },
  { value: 'count', label: 'Count (=1)' },
]

export function AttractivityDropdown() {
  const { attractivityMode, setAttractivityMode, selectedLandUse } = useAppContext()
  const isCustomMode = selectedLandUse === 'Custom'

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!isCustomMode) {
      setAttractivityMode(e.target.value as AttractivityMode)
    }
  }

  // In custom mode, always show "count" as the value
  const displayValue = isCustomMode ? 'count' : attractivityMode

  return (
    <select
      value={displayValue}
      onChange={handleChange}
      disabled={isCustomMode}
      className="param-dropdown"
      title={isCustomMode ? 'Locked to Count for Custom pins' : ''}
    >
      {MODES.map(mode => (
        <option key={mode.value} value={mode.value}>
          {mode.label}
        </option>
      ))}
    </select>
  )
}
