import type { CustomPathPoint, CustomPathStep, MovementPattern } from './types'

function emptyGrid(n: number): number[][] {
  return Array.from({ length: n }, () => Array(n).fill(0))
}

function getPatternGroups(cells: CustomPathPoint[], pattern: MovementPattern): CustomPathPoint[][] {
  const keyed = new Map<number, CustomPathPoint[]>()
  const keyFn = (c: CustomPathPoint): number => {
    switch (pattern) {
      case 'wave-lr': return c.col
      case 'wave-rl': return -c.col
      case 'wave-tb': return c.row
      case 'wave-bt': return -c.row
      case 'diagonal': return c.row + c.col
      case 'pulse': {
        const rows = cells.map((cc) => cc.row)
        const cols = cells.map((cc) => cc.col)
        const mr = (Math.min(...rows) + Math.max(...rows)) / 2
        const mc = (Math.min(...cols) + Math.max(...cols)) / 2
        return Math.max(Math.abs(c.row - mr), Math.abs(c.col - mc))
      }
    }
  }
  for (const c of cells) {
    const k = keyFn(c)
    if (!keyed.has(k)) keyed.set(k, [])
    keyed.get(k)!.push(c)
  }
  return Array.from(keyed.entries()).sort((a, b) => a[0] - b[0]).map((e) => e[1])
}

function cellAlpha(c: CustomPathPoint, stepFallback?: number): number {
  return Math.max(0, Math.min(1, ((c.opacity ?? stepFallback ?? 100) / 100)))
}

function pathToFrames(path: CustomPathStep[], gridSize: number): number[][][] {
  const frames: number[][][] = []
  const revealed = new Map<string, number>()

  for (let i = 0; i < path.length; i++) {
    const step = path[i]
    const newCells = step.cells.filter(c => !revealed.has(`${c.row},${c.col}`))

    if (!step.pattern || newCells.length <= 1) {
      for (const c of newCells) revealed.set(`${c.row},${c.col}`, cellAlpha(c, step.opacity))
      const frame = emptyGrid(gridSize)
      for (const [key, val] of revealed) {
        const [r, c] = key.split(',').map(Number)
        frame[r][c] = val
      }
      frames.push(frame)
    } else {
      const groups = getPatternGroups(newCells, step.pattern)
      for (const group of groups) {
        const frame = emptyGrid(gridSize)
        for (const c of group) frame[c.row][c.col] = cellAlpha(c, step.opacity)
        frames.push(frame)
      }
      for (const c of newCells) revealed.set(`${c.row},${c.col}`, cellAlpha(c, step.opacity))
    }
  }

  return frames.length > 0 ? frames : [emptyGrid(gridSize)]
}

function pointToStep(p: CustomPathPoint): CustomPathStep {
  return { cells: [p] }
}

export function generateCustomFrames(path: CustomPathStep[], gridSize: number): number[][][] {
  if (path.length === 0) return [emptyGrid(gridSize)]
  return pathToFrames(path, gridSize)
}

export const patternGenerators: Record<string, (n: number) => number[][][]> = {
  spiral: (n) => {
    const order: [number, number][] = []
    let top = 0, bottom = n - 1, left = 0, right = n - 1
    while (top <= bottom && left <= right) {
      for (let i = left; i <= right; i++) order.push([top, i])
      top++
      for (let i = top; i <= bottom; i++) order.push([i, right])
      right--
      if (top <= bottom) { for (let i = right; i >= left; i--) order.push([bottom, i]); bottom-- }
      if (left <= right) { for (let i = bottom; i >= top; i--) order.push([i, left]); left++ }
    }
    return pathToFrames(order.map(([r, c]) => ({ cells: [{ row: r, col: c }] })), n)
  },

  corners: (n) => {
    const pts: CustomPathPoint[] = [
      { row: 0, col: 0 },
      { row: 0, col: n - 1 },
      { row: n - 1, col: 0 },
      { row: n - 1, col: n - 1 },
    ]
    return pathToFrames(pts.map(pointToStep), n)
  },

  'plus': (n) => {
    const mid = Math.floor(n / 2)
    const pts: CustomPathPoint[] = []
    for (let i = 0; i < n; i++) pts.push({ row: mid, col: i })
    for (let i = 0; i < n; i++) if (i !== mid) pts.push({ row: i, col: mid })
    return pathToFrames(pts.map(pointToStep), n)
  },

  triangle: (n) => {
    const pts: CustomPathPoint[] = []
    for (let r = 0; r < n; r++)
      for (let c = 0; c <= r; c++)
        pts.push({ row: r, col: c })
    return pathToFrames(pts.map(pointToStep), n)
  },

  'wave-lr': (n) => {
    const frames: number[][][] = []
    for (let c = 0; c < n; c++) {
      const frame = emptyGrid(n)
      for (let r = 0; r < n; r++) frame[r][c] = 1
      frames.push(frame)
    }
    return frames
  },

  'wave-tb': (n) => {
    const frames: number[][][] = []
    for (let r = 0; r < n; r++) {
      const frame = emptyGrid(n)
      for (let c = 0; c < n; c++) frame[r][c] = 1
      frames.push(frame)
    }
    return frames
  },

  'wave-rl': (n) => {
    const frames: number[][][] = []
    for (let c = n - 1; c >= 0; c--) {
      const frame = emptyGrid(n)
      for (let r = 0; r < n; r++) frame[r][c] = 1
      frames.push(frame)
    }
    return frames
  },

  'tl-br': (n) => {
    const pts: CustomPathPoint[] = []
    for (let i = 0; i < n; i++) pts.push({ row: i, col: i })
    return pathToFrames(pts.map(pointToStep), n)
  },

  'i-left': (n) => {
    const mid = Math.floor(n / 2)
    const pts: CustomPathPoint[] = []
    for (let i = 0; i < n; i++) pts.push({ row: mid, col: i })
    return pathToFrames(pts.map(pointToStep), n)
  },

  'left-right': (n) => {
    const pts: CustomPathPoint[] = []
    for (let i = 0; i < n; i++) {
      pts.push({ row: i, col: 0 })
      pts.push({ row: i, col: n - 1 })
    }
    return pathToFrames(pts.map(pointToStep), n)
  },

  'striangle': (n) => {
    const pts: CustomPathPoint[] = []
    for (let c = 0; c < n; c++)
      for (let r = 0; r <= c; r++)
        pts.push({ row: r, col: c })
    return pathToFrames(pts.map(pointToStep), n)
  },

  'scorners': (n) => {
    const pts: CustomPathPoint[] = [
      { row: 0, col: 0 },
      { row: 0, col: n - 1 },
      { row: Math.floor(n / 2), col: Math.floor(n / 2) },
      { row: n - 1, col: 0 },
      { row: n - 1, col: n - 1 },
      { row: Math.floor(n / 2), col: Math.floor(n / 2) },
    ]
    return pathToFrames(pts.map(pointToStep), n)
  },

  'pulse': (n) => {
    const frames: number[][][] = []
    const mid = Math.floor(n / 2)
    for (let radius = 0; radius <= mid; radius++) {
      const frame = emptyGrid(n)
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++)
          if (Math.max(Math.abs(r - mid), Math.abs(c - mid)) === radius)
            frame[r][c] = 1
      frames.push(frame)
    }
    return frames
  },

  diagonal: (n) => {
    const frames: number[][][] = []
    for (let offset = -(n - 1); offset < n; offset++) {
      const frame = emptyGrid(n)
      for (let r = 0; r < n; r++) {
        const c = r - offset
        if (c >= 0 && c < n) frame[r][c] = 1
      }
      frames.push(frame)
    }
    return frames
  },

  fill: (n) => {
    const pts: CustomPathPoint[] = []
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        pts.push({ row: r, col: c })
    return pathToFrames(pts.map(pointToStep), n)
  },

  snake: (n) => {
    const pts: CustomPathPoint[] = []
    for (let r = 0; r < n; r++) {
      if (r % 2 === 0) {
        for (let c = 0; c < n; c++) pts.push({ row: r, col: c })
      } else {
        for (let c = n - 1; c >= 0; c--) pts.push({ row: r, col: c })
      }
    }
    return pathToFrames(pts.map(pointToStep), n)
  },

  cross: (n) => {
    const pts: CustomPathPoint[] = []
    for (let i = 0; i < n; i++) {
      pts.push({ row: i, col: i })
      pts.push({ row: i, col: n - 1 - i })
    }
    return pathToFrames(pts.map(pointToStep), n)
  },
}

export const presetNames = Object.keys(patternGenerators)

export function getPresetColor(name: string): string {
  const colors: Record<string, string> = {
    spiral: '#00d4ff',
    corners: '#ffeaa7',
    plus: '#ff4757',
    triangle: '#ffeaa7',
    'wave-lr': '#ffeaa7',
    'wave-tb': '#ff4757',
    'wave-rl': '#00d4ff',
    'tl-br': '#ffeaa7',
    'i-left': '#ff4757',
    'left-right': '#00d4ff',
    striangle: '#00d4ff',
    scorners: '#ffeaa7',
    pulse: '#00d4ff',
    diagonal: '#ffeaa7',
    fill: '#00d4ff',
    snake: '#ff4757',
    cross: '#ffeaa7',
  }
  return colors[name] ?? '#00d4ff'
}
