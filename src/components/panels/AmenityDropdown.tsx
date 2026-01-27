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
    <div className="flex flex-col">
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
        <option value="Custom">Custom</option>
      </select>

      {/* Custom mode info */}
      {isCustomSelected && (
        <>
          <p className="text-xs text-gray-500 mt-1">Add amenities by clicking on map</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm font-semibold" style={{ color: '#d4a800' }}>
              Total amenities: {customPins.length}
            </span>
            {customPins.length > 0 && (
              <button
                onClick={clearCustomPins}
                className="text-red-500 hover:text-red-700 text-sm underline"
              >
                Clear all
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
