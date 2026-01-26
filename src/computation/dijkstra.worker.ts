import { dijkstra, type SimpleEdge } from './dijkstraAlgorithm'

export interface WorkerInput {
  nodes: Array<{ id: string; coord: [number, number] }>
  edges: Array<{ from: string; to: string; weight: number }>
  sourceNodeIds: string[]
}

export interface WorkerProgress {
  type: 'progress'
  percent: number
}

export interface WorkerResult {
  type: 'result'
  // Serialized as array of [sourceId, array of [targetId, distance]]
  matrix: Array<[string, Array<[string, number]>]>
}

self.onmessage = (event: MessageEvent<WorkerInput>) => {
  const { edges, sourceNodeIds } = event.data

  // Build adjacency list
  const adjacency = new Map<string, SimpleEdge[]>()
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, [])
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, [])
    adjacency.get(edge.from)!.push({ to: edge.to, weight: edge.weight })
  }

  const matrix: Array<[string, Array<[string, number]>]> = []
  const total = sourceNodeIds.length
  let lastProgressPct = 0

  for (let i = 0; i < total; i++) {
    const sourceId = sourceNodeIds[i]
    const distances = dijkstra(sourceId, adjacency)

    // Convert Map to array for serialization
    const distArray: Array<[string, number]> = []
    for (const [nodeId, dist] of distances) {
      distArray.push([nodeId, dist])
    }
    matrix.push([sourceId, distArray])

    // Report progress every 5%
    const pct = Math.floor(((i + 1) / total) * 100)
    if (pct >= lastProgressPct + 5 || i === total - 1) {
      lastProgressPct = pct
      const progress: WorkerProgress = { type: 'progress', percent: pct }
      self.postMessage(progress)
    }
  }

  const result: WorkerResult = { type: 'result', matrix }
  self.postMessage(result)
}
