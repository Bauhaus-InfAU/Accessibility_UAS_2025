import { useAppContext } from '../../context/AppContext'
import { LAND_USE_SHORT_NAMES } from '../../config/constants'

export function AmenitySelector() {
  const { availableLandUses, selectedLandUse, setSelectedLandUse } = useAppContext()

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
      </div>
    </div>
  )
}
