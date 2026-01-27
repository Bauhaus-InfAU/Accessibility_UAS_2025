export function Legend() {
  return (
    <div className="absolute bottom-8 right-8 glass-panel floating-panel px-4 py-3">
      <label className="text-xs font-medium text-gray-600 block mb-2">
        Accessibility Score
      </label>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500">Low</span>
        <div
          className="w-32 h-3 rounded"
          style={{
            background: 'linear-gradient(to right, #4A3AB4, #FD681D, #FD1D1D)',
          }}
        />
        <span className="text-[10px] text-gray-500">High</span>
      </div>
    </div>
  )
}
