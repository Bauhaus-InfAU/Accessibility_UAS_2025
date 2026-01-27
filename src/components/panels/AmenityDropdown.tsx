import { useAppContext } from '../../context/AppContext'
import { LAND_USE_SHORT_NAMES } from '../../config/constants'
import type { LandUse } from '../../config/types'

export function AmenityDropdown() {
  const { availableLandUses, selectedLandUse, setSelectedLandUse, customPins, clearCustomPins } = useAppContext()
  const isCustomSelected = selectedLandUse === 'Custom'

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLandUse(e.target.value as LandUse)
  }

  return (
    <div className="flex flex-col gap-2">
      <select
        value={selectedLandUse}
        onChange={handleChange}
        className="param-dropdown"
      >
        {availableLandUses.map(lu => (
          <option key={lu} value={lu}>
            {LAND_USE_SHORT_NAMES[lu]}
          </option>
        ))}
        <option value="Custom">Custom (click map)</option>
      </select>

      {/* Custom mode info bar */}
      {isCustomSelected && (
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span className="text-yellow-600 font-medium">
            {customPins.length} {customPins.length === 1 ? 'pin' : 'pins'}
          </span>
          {customPins.length > 0 && (
            <button
              onClick={clearCustomPins}
              className="text-red-500 hover:text-red-700 underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  )
}
