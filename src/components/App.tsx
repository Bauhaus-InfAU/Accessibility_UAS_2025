import { AppProvider, useAppContext } from '../context/AppContext'
import { MapProvider } from '../context/MapContext'
import { MapView } from './map/MapView'
import { ParametersPanel } from './panels/ParametersPanel'
import { NavigationWidget } from './panels/NavigationWidget'
import { Legend } from './panels/Legend'
import { AppInfo } from './panels/AppInfo'
import { LoadingOverlay } from './LoadingOverlay'

function AppContent() {
  const { isLoading } = useAppContext()

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      {/* Full-screen map */}
      <MapView />

      {/* Floating overlay container - click-through */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <ParametersPanel />
        <NavigationWidget />
        <Legend />
        <AppInfo />
      </div>

      {isLoading && <LoadingOverlay />}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <MapProvider>
        <AppContent />
      </MapProvider>
    </AppProvider>
  )
}
