import { AppProvider, useAppContext } from '../context/AppContext'
import { ControlPanel } from './panels/ControlPanel'
import { MapView } from './map/MapView'
import { LoadingOverlay } from './LoadingOverlay'

function AppContent() {
  const { isLoading } = useAppContext()

  return (
    <div className="h-screen flex">
      <ControlPanel />
      <MapView />
      {isLoading && <LoadingOverlay />}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
