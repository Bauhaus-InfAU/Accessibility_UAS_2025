import type { Building, DistanceMatrix, AttractivityMode, LandUse, CustomPin } from '../config/types'
import { getDistance } from './distanceMatrix'

function getAttractivity(building: Building, landUse: LandUse, mode: AttractivityMode): number {
  const area = building.landUseAreas[landUse] || 0
  switch (mode) {
    case 'floorArea':
      return area
    case 'volume':
      return area * building.height
    case 'count':
      return area > 0 ? 1 : 0
  }
}

export function calculateAccessibility(
  residentialBuildings: Building[],
  amenityBuildings: Building[],
  selectedLandUse: LandUse,
  distanceMatrix: DistanceMatrix,
  curveEvaluator: (distance: number) => number,
  attractivityMode: AttractivityMode
): Map<string, number> {
  const rawScores = new Map<string, number>()

  for (const resBuilding of residentialBuildings) {
    if (!resBuilding.nearestNodeId) continue

    let acc = 0
    for (const amenity of amenityBuildings) {
      if (!amenity.nearestNodeId) continue

      const dist = getDistance(distanceMatrix, resBuilding.nearestNodeId, amenity.nearestNodeId)
      if (dist === undefined) continue

      const decay = curveEvaluator(dist)
      if (decay <= 0) continue

      const attractivity = getAttractivity(amenity, selectedLandUse, attractivityMode)
      if (attractivity <= 0) continue

      acc += attractivity * decay
    }

    rawScores.set(resBuilding.id, acc)
  }

  return rawScores
}

export function calculateAccessibilityFromPins(
  residentialBuildings: Building[],
  customPins: CustomPin[],
  distanceMatrix: DistanceMatrix,
  curveEvaluator: (distance: number) => number
): Map<string, number> {
  const rawScores = new Map<string, number>()

  for (const resBuilding of residentialBuildings) {
    if (!resBuilding.nearestNodeId) continue

    let acc = 0
    for (const pin of customPins) {
      if (!pin.nearestNodeId) continue

      const dist = getDistance(distanceMatrix, resBuilding.nearestNodeId, pin.nearestNodeId)
      if (dist === undefined) continue

      const decay = curveEvaluator(dist)
      if (decay <= 0) continue

      // Use pin's attractivity value
      const attractivity = pin.attractivity ?? 1
      if (attractivity <= 0) continue

      acc += attractivity * decay
    }

    rawScores.set(resBuilding.id, acc)
  }

  return rawScores
}

export function normalizeScores(scores: Map<string, number>): Map<string, number> {
  if (scores.size === 0) return new Map()

  let min = Infinity
  let max = -Infinity
  for (const value of scores.values()) {
    if (value < min) min = value
    if (value > max) max = value
  }

  const range = max - min
  const normalized = new Map<string, number>()

  if (range === 0) {
    // All values are the same
    for (const [id] of scores) {
      normalized.set(id, scores.get(id)! > 0 ? 1 : 0)
    }
  } else {
    for (const [id, value] of scores) {
      normalized.set(id, (value - min) / range)
    }
  }

  return normalized
}
