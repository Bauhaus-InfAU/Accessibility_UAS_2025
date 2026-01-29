// Binary heap priority queue for Dijkstra
class MinHeap {
  private heap: Array<{ id: string; dist: number }> = []

  push(id: string, dist: number) {
    this.heap.push({ id, dist })
    this.bubbleUp(this.heap.length - 1)
  }

  pop(): { id: string; dist: number } | undefined {
    if (this.heap.length === 0) return undefined
    const top = this.heap[0]
    const last = this.heap.pop()!
    if (this.heap.length > 0) {
      this.heap[0] = last
      this.bubbleDown(0)
    }
    return top
  }

  get size() { return this.heap.length }

  private bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.heap[i].dist >= this.heap[parent].dist) break
      ;[this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]]
      i = parent
    }
  }

  private bubbleDown(i: number) {
    const n = this.heap.length
    while (true) {
      let smallest = i
      const left = 2 * i + 1
      const right = 2 * i + 2
      if (left < n && this.heap[left].dist < this.heap[smallest].dist) smallest = left
      if (right < n && this.heap[right].dist < this.heap[smallest].dist) smallest = right
      if (smallest === i) break
      ;[this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]]
      i = smallest
    }
  }
}

export interface SimpleEdge {
  to: string
  weight: number
}

/**
 * Run Dijkstra from a single source node.
 * Returns a Map of nodeId -> shortest distance from source.
 */
export function dijkstra(
  sourceId: string,
  adjacency: Map<string, SimpleEdge[]>
): Map<string, number> {
  const dist = new Map<string, number>()
  const visited = new Set<string>()
  const heap = new MinHeap()

  dist.set(sourceId, 0)
  heap.push(sourceId, 0)

  while (heap.size > 0) {
    const current = heap.pop()!
    if (visited.has(current.id)) continue
    visited.add(current.id)

    const edges = adjacency.get(current.id)
    if (!edges) continue

    for (const edge of edges) {
      if (visited.has(edge.to)) continue
      const newDist = current.dist + edge.weight
      const oldDist = dist.get(edge.to)
      if (oldDist === undefined || newDist < oldDist) {
        dist.set(edge.to, newDist)
        heap.push(edge.to, newDist)
      }
    }
  }

  return dist
}

/**
 * Run Dijkstra from source to target node, returning both distance and path.
 * Early exits when target is found for optimization.
 * Returns null if target is not reachable.
 */
export function dijkstraWithPath(
  sourceId: string,
  targetId: string,
  adjacency: Map<string, SimpleEdge[]>
): { distance: number; path: string[] } | null {
  const dist = new Map<string, number>()
  const parent = new Map<string, string>()
  const visited = new Set<string>()
  const heap = new MinHeap()

  dist.set(sourceId, 0)
  heap.push(sourceId, 0)

  while (heap.size > 0) {
    const current = heap.pop()!
    if (visited.has(current.id)) continue
    visited.add(current.id)

    // Early exit when target is found
    if (current.id === targetId) {
      // Reconstruct path from target to source
      const path: string[] = []
      let node: string | undefined = targetId
      while (node !== undefined) {
        path.push(node)
        node = parent.get(node)
      }
      path.reverse()
      return { distance: current.dist, path }
    }

    const edges = adjacency.get(current.id)
    if (!edges) continue

    for (const edge of edges) {
      if (visited.has(edge.to)) continue
      const newDist = current.dist + edge.weight
      const oldDist = dist.get(edge.to)
      if (oldDist === undefined || newDist < oldDist) {
        dist.set(edge.to, newDist)
        parent.set(edge.to, current.id)
        heap.push(edge.to, newDist)
      }
    }
  }

  // Target not reachable
  return null
}
