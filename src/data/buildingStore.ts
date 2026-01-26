import type { Feature, MultiPolygon } from 'geojson'
import type { Building, BuildingsGeoJSON, LandUse } from '../config/types'

const ALL_LAND_USES: LandUse[] = [
  'Generic Residential',
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
  'Generic Utilities',
  'Undefined Land use',
]

function calculateCentroid(feature: Feature<MultiPolygon>): [number, number] {
  let sumX = 0
  let sumY = 0
  let count = 0

  for (const polygon of feature.geometry.coordinates) {
    // Use exterior ring (first ring) of each polygon
    const ring = polygon[0]
    for (const coord of ring) {
      sumX += coord[0]
      sumY += coord[1]
      count++
    }
  }

  return count > 0 ? [sumX / count, sumY / count] : [0, 0]
}

export function processBuildings(geojson: BuildingsGeoJSON): Building[] {
  const buildings: Building[] = []

  for (const feature of geojson.features) {
    const props = feature.properties
    if (!props) continue

    const id = String(props['Building ID'] || '')
    if (!id) continue

    const height = parseFloat(props['Height'] || '0')
    const floors = parseInt(props['Floors'] || '1', 10)
    const centroid = calculateCentroid(feature as Feature<MultiPolygon>)

    const landUseAreas: Partial<Record<LandUse, number>> = {}
    let isResidential = false

    for (const lu of ALL_LAND_USES) {
      const area = parseFloat(props[lu] || '0')
      if (area > 0) {
        landUseAreas[lu] = area
        if (lu === 'Generic Residential') {
          isResidential = true
        }
      }
    }

    buildings.push({
      id,
      centroid,
      height,
      floors,
      landUseAreas,
      isResidential,
      nearestNodeId: '', // assigned later
      feature: feature as Feature<MultiPolygon>,
    })
  }

  return buildings
}

export function getBuildingsWithLandUse(buildings: Building[], landUse: LandUse): Building[] {
  return buildings.filter(b => (b.landUseAreas[landUse] || 0) > 0)
}

export function getAvailableLandUses(buildings: Building[]): LandUse[] {
  const usesSet = new Set<LandUse>()
  for (const b of buildings) {
    for (const lu of Object.keys(b.landUseAreas) as LandUse[]) {
      if (lu !== 'Generic Residential' && lu !== 'Undefined Land use' && lu !== 'Generic Utilities') {
        usesSet.add(lu)
      }
    }
  }
  return Array.from(usesSet).sort()
}
