import type { BuildingsGeoJSON, StreetsGeoJSON } from '../config/types'

export async function loadBuildingsGeoJSON(): Promise<BuildingsGeoJSON> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/weimar-buildings.geojson`)
  if (!response.ok) throw new Error('Failed to load buildings data')
  return response.json()
}

export async function loadStreetsGeoJSON(): Promise<StreetsGeoJSON> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/weimar-streets.geojson`)
  if (!response.ok) throw new Error('Failed to load streets data')
  return response.json()
}
