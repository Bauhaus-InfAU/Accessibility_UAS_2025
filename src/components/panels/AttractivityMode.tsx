import { useAppContext } from '../../context/AppContext'
import type { AttractivityMode as AttractivityModeType } from '../../config/types'

const MODES: { value: AttractivityModeType; label: string; description: string }[] = [
  { value: 'floorArea', label: 'Floor Area', description: 'Att = sqm of land use' },
  { value: 'volume', label: 'Volume', description: 'Att = area × height' },
  { value: 'count', label: 'Count (=1)', description: 'Att = 1 for each' },
]

export function AttractivityMode() {
  const { attractivityMode, setAttractivityMode, selectedLandUse } = useAppContext()
  const isCustomMode = selectedLandUse === 'Custom'

  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-2">
        Attractivity (Att_j)
        {isCustomMode && <span className="text-yellow-600 ml-1">(locked to Count for Custom)</span>}
      </label>
      <div className={`flex flex-col gap-1 ${isCustomMode ? 'opacity-50 pointer-events-none' : ''}`}>
        {MODES.map(mode => (
          <label
            key={mode.value}
            className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs ${
              (isCustomMode ? mode.value === 'count' : attractivityMode === mode.value)
                ? 'bg-blue-50 text-blue-800'
                : 'hover:bg-gray-50 text-gray-700'
            }`}
          >
            <input
              type="radio"
              name="attractivity"
              checked={isCustomMode ? mode.value === 'count' : attractivityMode === mode.value}
              onChange={() => !isCustomMode && setAttractivityMode(mode.value)}
              disabled={isCustomMode}
              className="w-3 h-3"
            />
            <span>
              {mode.label}
              <span className="text-gray-400 ml-1">({mode.description})</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
