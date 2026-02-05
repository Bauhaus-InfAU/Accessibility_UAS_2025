import { AppProvider, useAppContext } from '../context/AppContext'
import { MapProvider } from '../context/MapContext'
import { MapView } from './map/MapView'
import { ParametersPanel } from './panels/ParametersPanel'
import { NavigationWidget } from './panels/NavigationWidget'
import { MeasurementWidget } from './panels/MeasurementWidget'
import { HelpTipWidget } from './panels/HelpTipWidget'
import { SettingsWidget } from './panels/SettingsWidget'
import { Legend } from './panels/Legend'
import { AppInfo } from './panels/AppInfo'
import { LoadingOverlay } from './LoadingOverlay'

function ToolsColumn() {
  const { isPanelCollapsed } = useAppContext()

  // On mobile: hidden when panel is open, visible when collapsed
  const mobileVisibility = isPanelCollapsed ? '' : 'hidden sm:flex'

  return (
    <div className={`tools-column absolute right-4 sm:right-5 top-1/2 -translate-y-1/2 flex flex-col items-end gap-2 pointer-events-auto z-10 ${mobileVisibility}`}>
      <SettingsWidget />
      <MeasurementWidget />
      <HelpTipWidget />
    </div>
  )
}

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
        <ToolsColumn />
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
