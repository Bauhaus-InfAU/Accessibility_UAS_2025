import { useAppContext } from '../../context/AppContext'
import { LAND_USE_SHORT_NAMES } from '../../config/constants'

export function AmenitySelector() {
  const { availableLandUses, selectedLandUse, setSelectedLandUse, customPins, clearCustomPins } = useAppContext()
  const isCustomSelected = selectedLandUse === 'Custom'

  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-2">
        Amenity Type
      </label>
      <div className="flex flex-col gap-1">
        {availableLandUses.map(lu => (
          <label
            key={lu}
            className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs ${
              selectedLandUse === lu ? 'bg-blue-50 text-blue-800' : 'hover:bg-gray-50 text-gray-700'
            }`}
          >
            <input
              type="radio"
              name="amenity"
              checked={selectedLandUse === lu}
              onChange={() => setSelectedLandUse(lu)}
              className="w-3 h-3"
            />
            <span>{LAND_USE_SHORT_NAMES[lu]}</span>
          </label>
        ))}
        {/* Custom option - always shown at the end */}
        <label
          className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs ${
            isCustomSelected ? 'bg-yellow-50 text-yellow-800' : 'hover:bg-gray-50 text-gray-700'
          }`}
        >
          <input
            type="radio"
            name="amenity"
            checked={isCustomSelected}
            onChange={() => setSelectedLandUse('Custom')}
            className="w-3 h-3"
          />
          <span>
            Custom (click map)
            {isCustomSelected && customPins.length > 0 && (
              <span className="text-yellow-600 ml-1">({customPins.length} pins)</span>
            )}
          </span>
        </label>
      </div>
      {/* Clear all pins button */}
      {isCustomSelected && customPins.length > 0 && (
        <button
          onClick={clearCustomPins}
          className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
        >
          Clear all pins
        </button>
      )}
    </div>
  )
}
