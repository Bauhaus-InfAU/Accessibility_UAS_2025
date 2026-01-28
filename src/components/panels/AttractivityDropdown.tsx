import { useAppContext } from '../../context/AppContext'
import type { AttractivityMode } from '../../config/types'

const MODES: { value: AttractivityMode; label: string }[] = [
  { value: 'floorArea', label: 'Floor Area' },
  { value: 'volume', label: 'Volume' },
  { value: 'count', label: 'Count (=1)' },
]

export function AttractivityDropdown() {
  const { attractivityMode, setAttractivityMode, selectedLandUse, totalCustomPinAttractivity } = useAppContext()
  const isCustomMode = selectedLandUse === 'Custom'

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!isCustomMode) {
      setAttractivityMode(e.target.value as AttractivityMode)
    }
  }

  // In custom mode, show instruction and total instead of dropdown
  // Add top padding to align with the dropdown height on the left column
  if (isCustomMode) {
    return (
      <div className="flex flex-col" style={{ paddingTop: '33px' }}>
        <p className="text-xs text-gray-500 mt-1">Set attractivity on map</p>
        <span className="text-sm font-semibold mt-1" style={{ color: '#d4a800' }}>
          Total attractivity: {totalCustomPinAttractivity}
        </span>
      </div>
    )
  }

  return (
    <select
      value={attractivityMode}
      onChange={handleChange}
      className="param-dropdown"
    >
      {MODES.map(mode => (
        <option key={mode.value} value={mode.value}>
          {mode.label}
        </option>
      ))}
    </select>
  )
}
