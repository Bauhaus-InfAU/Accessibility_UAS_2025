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
          className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded-full transition-colors ${
            value === option.value
              ? 'bg-white text-purple-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          {value === option.value && (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {option.label}
        </button>
      ))}
    </div>
  )
}
