import { useAppContext } from '../../context/AppContext'
import { LAND_USE_SHORT_NAMES, LAND_USE_COLORS } from '../../config/constants'

export function AmenitySelector() {
  const { availableLandUses, selectedLandUse, setSelectedLandUse, showAmenityPreview, setShowAmenityPreview } = useAppContext()

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
            <span
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: LAND_USE_COLORS[lu] }}
            />
            <span>{LAND_USE_SHORT_NAMES[lu]}</span>
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 mt-3 pt-2 border-t text-xs text-gray-600">
        <input
          type="checkbox"
          checked={showAmenityPreview}
          onChange={(e) => setShowAmenityPreview(e.target.checked)}
          className="w-3 h-3"
        />
        Highlight amenity buildings
      </label>
    </div>
  )
}
