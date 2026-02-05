import { type CurveTabMode } from '../../config/types'

export type CoefficientHoverType = 'alpha' | 'b' | 'c' | null

interface CoefficientInputsProps {
  mode: CurveTabMode
  negExpAlpha: number
  expPowerB: number
  expPowerC: number
  onNegExpAlphaChange: (value: number) => void
  onExpPowerBChange: (value: number) => void
  onExpPowerCChange: (value: number) => void
  hoveredCoefficient?: CoefficientHoverType
  onCoefficientHover?: (coefficient: CoefficientHoverType) => void
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
  hoveredCoefficient,
  onCoefficientHover,
}: CoefficientInputsProps) {
  const isAlphaHovered = hoveredCoefficient === 'alpha'
  const isBHovered = hoveredCoefficient === 'b'
  const isCHovered = hoveredCoefficient === 'c'

  const labelBaseClass = "text-sm min-w-24 transition-colors"
  const labelNormalClass = `${labelBaseClass} text-gray-600`
  const labelHighlightClass = `${labelBaseClass} font-semibold`
  const highlightStyle = { color: '#5631ad' }

  const inputBaseClass = "w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
  const inputHighlightClass = `${inputBaseClass} font-semibold`

  if (mode === 'negativeExponential') {
    return (
      <div className="mt-4 space-y-3">
        {/* Alpha input */}
        <div
          className="flex items-center gap-3"
          onMouseEnter={() => onCoefficientHover?.('alpha')}
          onMouseLeave={() => onCoefficientHover?.(null)}
        >
          <label
            className={isAlphaHovered ? labelHighlightClass : labelNormalClass}
            style={isAlphaHovered ? highlightStyle : undefined}
          >
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
            className={isAlphaHovered ? inputHighlightClass : inputBaseClass}
            style={isAlphaHovered ? highlightStyle : undefined}
          />
        </div>

      </div>
    )
  }

  if (mode === 'exponentialPower') {
    return (
      <div className="mt-4 space-y-3">
        {/* b (scale) input */}
        <div
          className="flex items-center gap-3"
          onMouseEnter={() => onCoefficientHover?.('b')}
          onMouseLeave={() => onCoefficientHover?.(null)}
        >
          <label
            className={isBHovered ? labelHighlightClass : labelNormalClass}
            style={isBHovered ? highlightStyle : undefined}
          >
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
            className={isBHovered ? inputHighlightClass : inputBaseClass}
            style={isBHovered ? highlightStyle : undefined}
          />
        </div>

        {/* c (shape) input */}
        <div
          className="flex items-center gap-3"
          onMouseEnter={() => onCoefficientHover?.('c')}
          onMouseLeave={() => onCoefficientHover?.(null)}
        >
          <label
            className={isCHovered ? labelHighlightClass : labelNormalClass}
            style={isCHovered ? highlightStyle : undefined}
          >
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
            className={isCHovered ? inputHighlightClass : inputBaseClass}
            style={isCHovered ? highlightStyle : undefined}
          />
        </div>

      </div>
    )
  }

  return null
}
