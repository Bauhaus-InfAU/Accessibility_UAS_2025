interface PillToggleProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}

export function PillToggle({ options, value, onChange }: PillToggleProps) {
  return (
    <div className="inline-flex rounded-full bg-gray-200 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1 text-sm rounded-full transition-colors ${
            value === option.value
              ? 'bg-white text-gray-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
