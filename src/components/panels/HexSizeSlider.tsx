import { HEX_DIAMETER_MIN, HEX_DIAMETER_MAX, HEX_DIAMETER_STEP } from '../../config/constants'

interface HexSizeSliderProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  label?: string
}

export function HexSizeSlider({ value, onChange, disabled = false, label = "Hexagon Size" }: HexSizeSliderProps) {
  // Calculate position percentage for the value label (0-100%)
  const positionPercent = ((value - HEX_DIAMETER_MIN) / (HEX_DIAMETER_MAX - HEX_DIAMETER_MIN)) * 100

  return (
    <div className={`hex-slider-row ${disabled ? 'opacity-50' : ''}`}>
      {/* Label */}
      <span className="hex-slider-label">{label}</span>
      {/* Slider with value above */}
      <div className="hex-slider-container">
        {/* Value label positioned above the handle */}
        <div className="hex-slider-value-track">
          <span
            className="hex-slider-value"
            style={{ left: `calc(7px + ${positionPercent / 100} * (100% - 14px))` }}
          >
            {value}m
          </span>
        </div>
        {/* Slider track */}
        <input
          type="range"
          min={HEX_DIAMETER_MIN}
          max={HEX_DIAMETER_MAX}
          step={HEX_DIAMETER_STEP}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="hex-slider"
        />
        {/* Min/max labels */}
        <div className="hex-slider-minmax">
          <span>{HEX_DIAMETER_MIN}m</span>
          <span>{HEX_DIAMETER_MAX}m</span>
        </div>
      </div>
    </div>
  )
}
