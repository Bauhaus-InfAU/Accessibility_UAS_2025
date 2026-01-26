import type { Building, DistanceMatrix, SerializedGraph } from '../config/types'
import type { WorkerInput, WorkerProgress, WorkerResult } from './dijkstra.worker'
import DijkstraWorker from './dijkstra.worker?worker'

export async function computeDistanceMatrix(
  serializedGraph: SerializedGraph,
  buildings: Building[],
  onProgress: (percent: number) => void
): Promise<DistanceMatrix> {
  // Collect unique source node IDs (from residential buildings)
  const sourceNodeIds = new Set<string>()
  for (const b of buildings) {
    if (b.isResidential && b.nearestNodeId) {
      sourceNodeIds.add(b.nearestNodeId)
    }
  }

  const sourceIds = Array.from(sourceNodeIds)

  return new Promise<DistanceMatrix>((resolve, reject) => {
    const worker = new DijkstraWorker()

    worker.onmessage = (event: MessageEvent<WorkerProgress | WorkerResult>) => {
      const data = event.data
      if (data.type === 'progress') {
        onProgress(data.percent)
      } else if (data.type === 'result') {
        // Convert serialized matrix back to Map<string, Map<string, number>>
        const matrix: DistanceMatrix = new Map()
        for (const [sourceId, distArray] of data.matrix) {
          const distMap = new Map<string, number>()
          for (const [targetId, dist] of distArray) {
            distMap.set(targetId, dist)
          }
          matrix.set(sourceId, distMap)
        }
        worker.terminate()
        resolve(matrix)
      }
    }

    worker.onerror = (error) => {
      worker.terminate()
      reject(new Error(`Worker error: ${error.message}`))
    }

    const input: WorkerInput = {
      nodes: serializedGraph.nodes,
      edges: serializedGraph.edges,
      sourceNodeIds: sourceIds,
    }
    worker.postMessage(input)
  })
}

export function getDistance(
  matrix: DistanceMatrix,
  fromNodeId: string,
  toNodeId: string
): number | undefined {
  return matrix.get(fromNodeId)?.get(toNodeId)
}
