interface ParameterSliderProps {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  label: string
  unit?: string
  decimals?: number
  disabled?: boolean
}

export function ParameterSlider({
  value,
  onChange,
  min,
  max,
  step,
  label,
  unit = '',
  decimals = 0,
  disabled = false
}: ParameterSliderProps) {
  // Calculate position percentage for the value label (0-100%)
  const positionPercent = ((value - min) / (max - min)) * 100

  // Format the display value
  const displayValue = decimals > 0 ? value.toFixed(decimals) : value.toString()

  return (
    <div className={`param-slider-row ${disabled ? 'opacity-50' : ''}`}>
      {/* Label */}
      <span className="param-slider-label">{label}</span>
      {/* Slider with value above */}
      <div className="param-slider-container">
        {/* Value label positioned above the handle */}
        <div className="param-slider-value-track">
          <span
            className="param-slider-value"
            style={{ left: `calc(7px + ${positionPercent / 100} * (100% - 14px))` }}
          >
            {displayValue}{unit}
          </span>
        </div>
        {/* Slider track */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="param-slider"
        />
        {/* Min/max labels */}
        <div className="param-slider-minmax">
          <span>{min}{unit}</span>
          <span>{max}{unit}</span>
        </div>
      </div>
    </div>
  )
}
