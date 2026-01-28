import { useAppContext } from '../context/AppContext'

export function LoadingOverlay() {
  const { loadingStatus, loadingProgress } = useAppContext()

  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Accessibility Analysis Builder</h2>
      <div className="w-64">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-200"
            style={{ width: `${loadingProgress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">{loadingStatus}</p>
      </div>
    </div>
  )
}
