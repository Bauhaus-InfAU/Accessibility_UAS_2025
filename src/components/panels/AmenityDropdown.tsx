import { useAppContext } from '../../context/AppContext'
import { LAND_USE_SHORT_NAMES } from '../../config/constants'
import type { LandUse } from '../../config/types'
import { PillDropdown } from './PillDropdown'

export function AmenityDropdown() {
  const { availableLandUses, selectedLandUse, setSelectedLandUse, gridAttractors, clearGridAttractors } = useAppContext()
  const isCustomSelected = selectedLandUse === 'Custom'

  // Build options array from available land uses plus Custom
  const options = [
    ...availableLandUses.map(lu => ({
      value: lu,
      label: LAND_USE_SHORT_NAMES[lu],
    })),
    { value: 'Custom', label: 'Custom' },
  ]

  return (
    <div className="flex flex-col">
      <PillDropdown
        options={options}
        value={selectedLandUse}
        onChange={(value) => setSelectedLandUse(value as LandUse)}
      />

      {/* Custom mode info - uses shared attractors */}
      {isCustomSelected && (
        <>
          <p className="instruction-text">Add amenities by clicking on map</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm font-semibold" style={{ color: '#d4a800' }}>
              Total amenities: {gridAttractors.length}
            </span>
            {gridAttractors.length > 0 && (
              <button
                onClick={clearGridAttractors}
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
