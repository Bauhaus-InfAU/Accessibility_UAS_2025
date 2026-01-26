export function Legend() {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 block mb-2">
        Accessibility Score
      </label>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500">Low</span>
        <div
          className="flex-1 h-3 rounded"
          style={{
            background: 'linear-gradient(to right, #2166ac, #f7f7f7, #b2182b)',
          }}
        />
        <span className="text-[10px] text-gray-500">High</span>
      </div>
    </div>
  )
}
