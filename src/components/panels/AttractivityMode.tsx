import { useAppContext } from '../../context/AppContext'
import type { AttractivityMode as AttractivityModeType } from '../../config/types'

const MODES: { value: AttractivityModeType; label: string; description: string }[] = [
  { value: 'floorArea', label: 'Floor Area', description: 'Att = sqm of land use' },
  { value: 'volume', label: 'Volume', description: 'Att = area × height' },
  { value: 'count', label: 'Count (=1)', description: 'Att = 1 for each' },
]

export function AttractivityMode() {
  const { attractivityMode, setAttractivityMode } = useAppContext()

  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-2">
        Attractivity (Att_j)
      </label>
      <div className="flex flex-col gap-1">
        {MODES.map(mode => (
          <label
            key={mode.value}
            className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs ${
              attractivityMode === mode.value ? 'bg-blue-50 text-blue-800' : 'hover:bg-gray-50 text-gray-700'
            }`}
          >
            <input
              type="radio"
              name="attractivity"
              checked={attractivityMode === mode.value}
              onChange={() => setAttractivityMode(mode.value)}
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
