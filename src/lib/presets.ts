import type { CustomPathPoint, CustomPathStep } from './types'

export interface PresetGeometry {
  points: (n: number) => CustomPathPoint[]
  isGroup: boolean
  groupPattern?: string
}

function pts(...cells: [number, number][]): CustomPathPoint[] {
  return cells.map(([row, col]) => ({ row, col }))
}

function spiral(n: number): CustomPathPoint[] {
  const order: CustomPathPoint[] = []
  let top = 0, bottom = n - 1, left = 0, right = n - 1
  while (top <= bottom && left <= right) {
    for (let i = left; i <= right; i++) order.push({ row: top, col: i })
    top++
    for (let i = top; i <= bottom; i++) order.push({ row: i, col: right })
    right--
    if (top <= bottom) { for (let i = right; i >= left; i--) order.push({ row: bottom, col: i }); bottom-- }
    if (left <= right) { for (let i = bottom; i >= top; i--) order.push({ row: i, col: left }); left++ }
  }
  return order
}

function plus(n: number): CustomPathPoint[] {
  const mid = Math.floor(n / 2)
  const r: CustomPathPoint[] = []
  for (let i = 0; i < n; i++) r.push({ row: mid, col: i })
  for (let i = 0; i < n; i++) if (i !== mid) r.push({ row: i, col: mid })
  return r
}

function triangle(n: number): CustomPathPoint[] {
  const r: CustomPathPoint[] = []
  for (let row = 0; row < n; row++)
    for (let col = 0; col <= row; col++)
      r.push({ row, col })
  return r
}

function waveLR(n: number): CustomPathPoint[] {
  const r: CustomPathPoint[] = []
  for (let c = 0; c < n; c++)
    for (let row = 0; row < n; row++)
      r.push({ row, col: c })
  return r
}

function waveTB(n: number): CustomPathPoint[] {
  const r: CustomPathPoint[] = []
  for (let row = 0; row < n; row++)
    for (let c = 0; c < n; c++)
      r.push({ row, col: c })
  return r
}

function waveRL(n: number): CustomPathPoint[] {
  const r: CustomPathPoint[] = []
  for (let c = n - 1; c >= 0; c--)
    for (let row = 0; row < n; row++)
      r.push({ row, col: c })
  return r
}

function tlbr(n: number): CustomPathPoint[] {
  return Array.from({ length: n }, (_, i) => ({ row: i, col: i }))
}

function iLeft(n: number): CustomPathPoint[] {
  const mid = Math.floor(n / 2)
  return Array.from({ length: n }, (_, i) => ({ row: mid, col: i }))
}

function leftRight(n: number): CustomPathPoint[] {
  const r: CustomPathPoint[] = []
  for (let i = 0; i < n; i++) {
    r.push({ row: i, col: 0 })
    r.push({ row: i, col: n - 1 })
  }
  return r
}

function stairTriangle(n: number): CustomPathPoint[] {
  const r: CustomPathPoint[] = []
  for (let c = 0; c < n; c++)
    for (let row = 0; row <= c; row++)
      r.push({ row, col: c })
  return r
}

function sCorners(n: number): CustomPathPoint[] {
  const mid = Math.floor(n / 2)
  return pts([0, 0], [0, n - 1], [mid, mid], [n - 1, 0], [n - 1, n - 1], [mid, mid])
}

function pulse(n: number): CustomPathPoint[] {
  const r: CustomPathPoint[] = []
  const mid = Math.floor(n / 2)
  for (let radius = 0; radius <= mid; radius++)
    for (let row = 0; row < n; row++)
      for (let c = 0; c < n; c++)
        if (Math.max(Math.abs(row - mid), Math.abs(c - mid)) === radius)
          r.push({ row, col: c })
  return r
}

function diagonal(n: number): CustomPathPoint[] {
  const r: CustomPathPoint[] = []
  for (let offset = -(n - 1); offset < n; offset++)
    for (let row = 0; row < n; row++) {
      const c = row - offset
      if (c >= 0 && c < n) r.push({ row, col: c })
    }
  return r
}

function fill(n: number): CustomPathPoint[] {
  const r: CustomPathPoint[] = []
  for (let row = 0; row < n; row++)
    for (let c = 0; c < n; c++)
      r.push({ row, col: c })
  return r
}

function snake(n: number): CustomPathPoint[] {
  const r: CustomPathPoint[] = []
  for (let row = 0; row < n; row++) {
    if (row % 2 === 0)
      for (let c = 0; c < n; c++) r.push({ row, col: c })
    else
      for (let c = n - 1; c >= 0; c--) r.push({ row, col: c })
  }
  return r
}

function cross(n: number): CustomPathPoint[] {
  const r: CustomPathPoint[] = []
  for (let i = 0; i < n; i++) {
    r.push({ row: i, col: i })
    r.push({ row: i, col: n - 1 - i })
  }
  return r
}

function checkerboard(n: number): CustomPathPoint[] {
  const r: CustomPathPoint[] = []
  for (let sum = 0; sum <= (n - 1) * 2; sum++)
    for (let row = 0; row < n; row++) {
      const c = sum - row
      if (c >= 0 && c < n) r.push({ row, col: c })
    }
  return r
}

function zigzag(n: number): CustomPathPoint[] {
  const r: CustomPathPoint[] = []
  for (let c = 0; c < n; c++) {
    if (c % 2 === 0)
      for (let row = 0; row < n; row++) r.push({ row, col: c })
    else
      for (let row = n - 1; row >= 0; row--) r.push({ row, col: c })
  }
  return r
}

function hourglass(n: number): CustomPathPoint[] {
  const r: CustomPathPoint[] = []
  for (let i = 0; i < n; i++) {
    r.push({ row: i, col: i })
    r.push({ row: i, col: n - 1 - i })
  }
  for (let i = n - 1; i >= 0; i--) {
    r.push({ row: n - 1 - i, col: Math.floor(n / 2) })
    r.push({ row: Math.floor(n / 2), col: i })
  }
  return r
}

function arrows(n: number): CustomPathPoint[] {
  const r: CustomPathPoint[] = []
  for (let row = 0; row < n; row++)
    for (let c = 0; c < n; c++)
      if (c === row || c === n - 1 - row || row === 0 || c === 0 || row === n - 1 || c === n - 1)
        r.push({ row, col: c })
  return r
}

function random(n: number): CustomPathPoint[] {
  const r: CustomPathPoint[] = []
  for (let row = 0; row < n; row++)
    for (let c = 0; c < n; c++)
      r.push({ row, col: c })
  let seed = 42
  function next() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]]
  }
  return r
}

export const PRESET_GEOMETRIES: Record<string, PresetGeometry> = {
  spiral: { points: spiral, isGroup: false },
  corners: { points: (n) => pts([0, 0], [0, n - 1], [n - 1, 0], [n - 1, n - 1]), isGroup: false },
  plus: { points: plus, isGroup: false },
  triangle: { points: triangle, isGroup: false },
  'wave-lr': { points: waveLR, isGroup: true, groupPattern: 'wave-lr' },
  'wave-tb': { points: waveTB, isGroup: true, groupPattern: 'wave-tb' },
  'wave-rl': { points: waveRL, isGroup: true, groupPattern: 'wave-rl' },
  'tl-br': { points: tlbr, isGroup: false },
  'i-left': { points: iLeft, isGroup: false },
  'left-right': { points: leftRight, isGroup: false },
  striangle: { points: stairTriangle, isGroup: false },
  scorners: { points: sCorners, isGroup: false },
  pulse: { points: pulse, isGroup: true, groupPattern: 'pulse' },
  diagonal: { points: diagonal, isGroup: true, groupPattern: 'diagonal' },
  fill: { points: fill, isGroup: false },
  snake: { points: snake, isGroup: false },
  cross: { points: cross, isGroup: false },
  checkerboard: { points: checkerboard, isGroup: false },
  zigzag: { points: zigzag, isGroup: false },
  rings: { points: pulse, isGroup: false },
  hourglass: { points: hourglass, isGroup: false },
  arrows: { points: arrows, isGroup: false },
  random: { points: random, isGroup: false },
}

export function presetToCustomPath(name: string, gridSize: number): CustomPathStep[] {
  const geo = PRESET_GEOMETRIES[name]
  if (!geo) return []
  const points = geo.points(gridSize)
  if (points.length === 0) return []
  if (geo.isGroup && geo.groupPattern)
    return [{ cells: points, buildAs: 'group', pattern: geo.groupPattern, timing: 'sequence', play: 'one-by-one', accumulate: true } as CustomPathStep]
  return [{ cells: points, buildAs: 'singles', play: 'one-by-one', timing: 'sequence', accumulate: true }]
}
