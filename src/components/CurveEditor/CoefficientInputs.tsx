import { type CurveTabMode } from '../../config/types'

interface CoefficientInputsProps {
  mode: CurveTabMode
  negExpAlpha: number
  expPowerB: number
  expPowerC: number
  onNegExpAlphaChange: (value: number) => void
  onExpPowerBChange: (value: number) => void
  onExpPowerCChange: (value: number) => void
}

/**
 * Input fields for mathematical function coefficients.
 */
export function CoefficientInputs({
  mode,
  negExpAlpha,
  expPowerB,
  expPowerC,
  onNegExpAlphaChange,
  onExpPowerBChange,
  onExpPowerCChange,
}: CoefficientInputsProps) {
  if (mode === 'negativeExponential') {
    return (
      <div className="mt-4 space-y-3">
        {/* Equation display */}
        <div className="equation text-center">
          f(d<sub>ij</sub>) = e<sup>-α·d<sub>ij</sub></sup>
        </div>

        {/* Alpha input */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 min-w-24">
            α (decay rate):
          </label>
          <input
            type="number"
            value={negExpAlpha}
            onChange={(e) => {
              const val = parseFloat(e.target.value)
              if (!isNaN(val) && val >= 0) {
                onNegExpAlphaChange(val)
              }
            }}
            step={0.0005}
            min={0}
            max={0.1}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

      </div>
    )
  }

  if (mode === 'exponentialPower') {
    return (
      <div className="mt-4 space-y-3">
        {/* Equation display */}
        <div className="equation text-center">
          f(d<sub>ij</sub>) = e<sup>-(d<sub>ij</sub>/b)<sup>c</sup></sup>
        </div>

        {/* b (scale) input */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 min-w-24">
            b (scale):
          </label>
          <input
            type="number"
            value={expPowerB}
            onChange={(e) => {
              const val = parseFloat(e.target.value)
              if (!isNaN(val) && val > 0) {
                onExpPowerBChange(val)
              }
            }}
            step={50}
            min={50}
            max={5000}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* c (shape) input */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 min-w-24">
            c (shape):
          </label>
          <input
            type="number"
            value={expPowerC}
            onChange={(e) => {
              const val = parseFloat(e.target.value)
              if (!isNaN(val) && val > 0) {
                onExpPowerCChange(val)
              }
            }}
            step={0.1}
            min={0.1}
            max={5}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

      </div>
    )
  }

  return null
}
