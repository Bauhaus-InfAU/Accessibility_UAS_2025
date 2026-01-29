import type { Feature, MultiPolygon, LineString, FeatureCollection } from 'geojson'

export type LandUse =
  | 'Generic Residential'
  | 'Generic Retail'
  | 'Generic Food and Beverage Service'
  | 'Generic Entertainment'
  | 'Generic Service'
  | 'Generic Health and Wellbeing'
  | 'Generic Education'
  | 'Generic Office Building'
  | 'Generic Culture'
  | 'Generic Civic Function'
  | 'Generic Sport Facility'
  | 'Generic Light Industrial'
  | 'Generic Accommodation'
  | 'Generic Transportation Service'
  | 'Generic Utilities'
  | 'Undefined Land use'
  | 'Custom'

export interface CustomPin {
  id: string
  coord: [number, number]
  nearestNodeId: string
  attractivity: number  // Default 1, editable by user
}

export interface Building {
  id: string
  centroid: [number, number] // [lng, lat]
  height: number
  floors: number
  landUseAreas: Partial<Record<LandUse, number>> // sqm per land use
  isResidential: boolean
  nearestNodeId: string // assigned after graph is built
  feature: Feature<MultiPolygon>
}

export interface GraphNode {
  id: string
  coord: [number, number] // [lng, lat]
}

export interface GraphEdge {
  to: string
  weight: number // distance in meters
}

export type AdjacencyList = Map<string, GraphEdge[]>

export interface StreetGraph {
  nodes: Map<string, GraphNode>
  adjacency: AdjacencyList
}

export interface SerializedGraph {
  nodes: Array<{ id: string; coord: [number, number] }>
  edges: Array<{ from: string; to: string; weight: number }>
}

export interface ControlPoint {
  x: number // distance in meters
  y: number // 0 to 1
}

// Tab-level curve mode for the curve editor
export type CurveTabMode = 'custom' | 'negativeExponential' | 'exponentialPower'

// Sub-mode within the Custom tab
export type CustomCurveType = 'polyline' | 'bezier'

// Legacy alias for backwards compatibility
export type CurveMode = CustomCurveType

export type AttractivityMode = 'floorArea' | 'volume' | 'count'

// Analysis mode: Buildings (original) or Grid (hexagon-based)
export type AnalysisMode = 'buildings' | 'grid'

// Amenity for grid mode (user-placed points that serve as destinations)
export interface GridAttractor {
  id: string
  coord: [number, number]
  nearestNodeId: string
  attractivity: number  // Default 1, editable by user
}

// Hexagon cell for grid analysis
export interface HexCell {
  id: string
  center: [number, number]
  vertices: [number, number][]  // 6 vertices
  nearestNodeId: string
  intersectsStreet: boolean
}

export type DistanceMatrix = Map<string, Map<string, number>> // fromNodeId -> toNodeId -> distance

// Measurement tool types
export interface MeasurementPoint {
  id: 'A' | 'B'
  coord: [number, number]
  nearestNodeId: string
}

export type BuildingsGeoJSON = FeatureCollection<MultiPolygon>
export type StreetsGeoJSON = FeatureCollection<LineString>
