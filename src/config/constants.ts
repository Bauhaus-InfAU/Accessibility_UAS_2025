import type { LandUse } from './types'

// Global accent colors used throughout the app
export const ACCENT_COLOR = '#5631ad'
export const ACCENT_COLOR_2 = '#fcdb02'

export const DEGREES_TO_METERS = 111000

export const COORD_PRECISION = 6

export const MAX_DISTANCE_DEFAULT = 2000 // meters for curve editor x-axis

export const LAND_USE_COLORS: Record<LandUse, string> = {
  'Generic Residential': '#d4a574',
  'Generic Retail': '#e8956a',
  'Generic Food and Beverage Service': '#c97b5a',
  'Generic Entertainment': '#b8694f',
  'Generic Service': '#a89080',
  'Generic Health and Wellbeing': '#7ba68a',
  'Generic Education': '#6b9b7a',
  'Generic Office Building': '#8fa4b8',
  'Generic Culture': '#9b7fb8',
  'Generic Civic Function': '#7a8fa8',
  'Generic Sport Facility': '#5a9b6b',
  'Generic Light Industrial': '#8a8a7a',
  'Generic Accommodation': '#b89070',
  'Generic Transportation Service': '#708090',
  'Generic Utilities': '#606060',
  'Undefined Land use': '#a0a0a0',
  'Custom': '#fcdb02',
}

export const LAND_USE_SHORT_NAMES: Record<LandUse, string> = {
  'Generic Residential': 'Residential',
  'Generic Retail': 'Retail',
  'Generic Food and Beverage Service': 'Food & Beverage',
  'Generic Entertainment': 'Entertainment',
  'Generic Service': 'Service',
  'Generic Health and Wellbeing': 'Health',
  'Generic Education': 'Education',
  'Generic Office Building': 'Office',
  'Generic Culture': 'Culture',
  'Generic Civic Function': 'Civic',
  'Generic Sport Facility': 'Sport',
  'Generic Light Industrial': 'Industrial',
  'Generic Accommodation': 'Accommodation',
  'Generic Transportation Service': 'Transport',
  'Generic Utilities': 'Utilities',
  'Undefined Land use': 'Undefined',
  'Custom': 'Custom',
}

// Land uses that can be destinations (everything except Residential, Utilities, Undefined)
export const DESTINATION_LAND_USES: LandUse[] = [
  'Generic Retail',
  'Generic Food and Beverage Service',
  'Generic Entertainment',
  'Generic Service',
  'Generic Health and Wellbeing',
  'Generic Education',
  'Generic Office Building',
  'Generic Culture',
  'Generic Civic Function',
  'Generic Sport Facility',
  'Generic Light Industrial',
  'Generic Accommodation',
  'Generic Transportation Service',
]

// Default curve: Exponential preset - approximates f(d) = e^(-0.003*d)
export const DEFAULT_POLYLINE_POINTS = [
  { x: 0, y: 1 },
  { x: 250, y: 0.472 },
  { x: 500, y: 0.223 },
  { x: 750, y: 0.105 },
  { x: 1000, y: 0.050 },
  { x: 1500, y: 0.011 },
  { x: 2000, y: 0.002 },
]

export const DEFAULT_BEZIER_HANDLES: [[number, number], [number, number]] = [
  [400, 1],   // first control handle
  [800, 0],   // second control handle
]

export const BUILDING_UNSCORED_COLOR = '#cccccc'

// Negative Exponential: f(d) = e^(-α * d)
export const DEFAULT_NEG_EXP_ALPHA = 0.003  // decay rate

// Exponential Power: f(d) = e^{-(d/b)^c}
export const DEFAULT_EXP_POWER_B = 700      // scale parameter
export const DEFAULT_EXP_POWER_C = 2        // shape parameter

// Terrain mesh configuration
export const TERRAIN_SEGMENTS = 64          // 65x65 = 4225 vertices
export const TERRAIN_HEIGHT_SCALE = 200     // meters per unit score
export const TERRAIN_CONTOUR_COUNT = 10     // number of contour lines
export const TERRAIN_SMOOTH_SIGMA = 1.0     // Gaussian blur radius (0 = no smoothing)

// Hexagon grid size configuration
export const HEX_DIAMETER_MIN = 10          // Minimum hexagon diameter in meters
export const HEX_DIAMETER_MAX = 100         // Maximum hexagon diameter in meters
export const HEX_DIAMETER_DEFAULT = 25      // Default hexagon diameter in meters
export const HEX_DIAMETER_STEP = 5          // Slider step in meters

// Terrain smoothing slider configuration
export const TERRAIN_SMOOTH_MIN = 0         // Minimum smoothing sigma (0 = no smoothing)
export const TERRAIN_SMOOTH_MAX = 2         // Maximum smoothing sigma
export const TERRAIN_SMOOTH_DEFAULT = 1.0   // Default smoothing sigma
export const TERRAIN_SMOOTH_STEP = 0.1      // Slider step

// Explorer tool palette (10 distinguishable colors, wraps via modulo)
export const EXPLORER_PALETTE = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#42d4f4',
  '#f032e6', '#bfef45', '#fabed4', '#469990', '#dcbeff',
]
export const EXPLORER_MAX_DISPLAY = 10 // max paths shown by default

// Terrain height slider configuration
export const TERRAIN_HEIGHT_MIN = 0         // Minimum terrain height scale in meters
export const TERRAIN_HEIGHT_MAX = 300       // Maximum terrain height scale in meters
export const TERRAIN_HEIGHT_DEFAULT = 200   // Default terrain height scale in meters
export const TERRAIN_HEIGHT_STEP = 10       // Slider step in meters
