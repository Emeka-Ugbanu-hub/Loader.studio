import type { CustomParallelTrack, CustomPathPoint, CustomPathStep, MovementPattern } from './types'

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

function copyFrame(frame: number[][]): number[][] {
  return frame.map((row) => [...row])
}

function frameFromRevealed(revealed: Map<string, number>, gridSize: number): number[][] {
  const frame = emptyGrid(gridSize)
  for (const [key, val] of revealed) {
    const [r, c] = key.split(',').map(Number)
    frame[r][c] = Math.max(frame[r][c], val)
  }
  return frame
}

function mergeFrame(base: number[][], overlay: number[][]): number[][] {
  const next = copyFrame(base)
  for (let r = 0; r < overlay.length; r++) {
    for (let c = 0; c < overlay[r].length; c++) {
      next[r][c] = Math.max(next[r][c], overlay[r][c])
    }
  }
  return next
}

function trackToFrames(track: CustomParallelTrack, gridSize: number, stepFallback?: number): number[][][] {
  const frames: number[][][] = []
  const cells = track.cells

  if (!track.pattern || cells.length <= 1) {
    const revealed = new Map<string, number>()
    for (const c of cells) {
      revealed.set(`${c.row},${c.col}`, cellAlpha(c, stepFallback))
      frames.push(frameFromRevealed(revealed, gridSize))
    }
    return frames.length > 0 ? frames : [emptyGrid(gridSize)]
  }

  for (const group of getPatternGroups(cells, track.pattern)) {
    const frame = emptyGrid(gridSize)
    for (const c of group) frame[c.row][c.col] = cellAlpha(c, stepFallback)
    frames.push(frame)
  }

  return frames.length > 0 ? frames : [emptyGrid(gridSize)]
}

function cellsToSequenceFrames(cells: CustomPathPoint[], gridSize: number, stepFallback?: number): number[][][] {
  const frames: number[][][] = []
  const revealed = new Map<string, number>()

  for (const c of cells) {
    revealed.set(`${c.row},${c.col}`, cellAlpha(c, stepFallback))
    frames.push(frameFromRevealed(revealed, gridSize))
  }

  return frames.length > 0 ? frames : [emptyGrid(gridSize)]
}

function cellsToSequenceFramesNoAccumulate(cells: CustomPathPoint[], gridSize: number, stepFallback?: number): number[][][] {
  const frames: number[][][] = []

  for (const c of cells) {
    const frame = emptyGrid(gridSize)
    frame[c.row][c.col] = cellAlpha(c, stepFallback)
    frames.push(frame)
  }

  return frames.length > 0 ? frames : [emptyGrid(gridSize)]
}

function cellsToTogetherFrame(cells: CustomPathPoint[], gridSize: number, stepFallback?: number): number[][][] {
  const frame = emptyGrid(gridSize)
  for (const c of cells) frame[c.row][c.col] = cellAlpha(c, stepFallback)
  return [frame]
}

function layerToFrames(step: CustomPathStep, gridSize: number): number[][][] {
  const cells = step.cells
  if (cells.length === 0) return [emptyGrid(gridSize)]

  if (step.buildAs === 'singles') {
    if (step.play === 'together') {
      return cellsToTogetherFrame(cells, gridSize, step.opacity)
    }
    return step.accumulate === false
      ? cellsToSequenceFramesNoAccumulate(cells, gridSize, step.opacity)
      : cellsToSequenceFrames(cells, gridSize, step.opacity)
  }

  if (step.play === 'together') {
    return cellsToTogetherFrame(cells, gridSize, step.opacity)
  }

  if (step.pattern) {
    return trackToFrames({ cells, pattern: step.pattern }, gridSize, step.opacity)
  }

  return cellsToSequenceFrames(cells, gridSize, step.opacity)
}

function compositeBlock(
  layers: CustomPathStep[],
  revealed: Map<string, number>,
  gridSize: number
): number[][][] {
  const baseFrame = frameFromRevealed(revealed, gridSize)
  const layerFrames = layers.map((layer) => layerToFrames(layer, gridSize))
  const longest = Math.max(...layerFrames.map((frames) => frames.length))

  return Array.from({ length: longest }, (_, frameIndex) => (
    layerFrames.reduce(
      (merged, frames) => mergeFrame(merged, frames[frameIndex % frames.length]),
      copyFrame(baseFrame)
    )
  ))
}

function revealLayer(layer: CustomPathStep, revealed: Map<string, number>) {
  for (const c of layer.cells) revealed.set(`${c.row},${c.col}`, cellAlpha(c, layer.opacity))
}

function pathToFrames(path: CustomPathStep[], gridSize: number): number[][][] {
  const frames: number[][][] = []
  const revealed = new Map<string, number>()

  for (let i = 0; i < path.length; i++) {
    const step = path[i]
    if (step.buildAs) {
      const layers = [step]
      while (i + 1 < path.length && path[i + 1].timing === 'simultaneous') {
        layers.push(path[i + 1])
        i++
      }

      frames.push(...compositeBlock(layers, revealed, gridSize))
      for (const layer of layers) revealLayer(layer, revealed)
      continue
    }

    const parallelTracks = step.tracks?.filter((track) => track.cells.length > 0) ?? []

    if (step.timing === 'simultaneous' && parallelTracks.length > 0) {
      const baseFrame = frameFromRevealed(revealed, gridSize)
      const trackFrames = parallelTracks.map((track) => trackToFrames(track, gridSize, step.opacity))
      const longest = Math.max(...trackFrames.map((track) => track.length))

      for (let frameIndex = 0; frameIndex < longest; frameIndex++) {
        const frame = trackFrames.reduce(
          (merged, track) => mergeFrame(merged, track[frameIndex % track.length]),
          copyFrame(baseFrame)
        )
        frames.push(frame)
      }

      for (const track of parallelTracks) {
        for (const c of track.cells) revealed.set(`${c.row},${c.col}`, cellAlpha(c, step.opacity))
      }
      continue
    }

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
  const expanded = path.flatMap((step) => {
    if (!step.accumulate || step.cells.length <= 1) return [step]
    return step.cells.map((c) => ({
      cells: [{ ...c }],
      buildAs: 'singles' as const,
      play: 'one-by-one' as const,
      timing: 'sequence' as const,
    }))
  })
  return pathToFrames(expanded, gridSize)
}

function motionFrame(frames: number[][][], frameIndex: number): number[][] {
  const frame = frames[frameIndex]
  const previous = frames[frameIndex - 1]
  const next = emptyGrid(frame.length)

  for (let r = 0; r < frame.length; r++) {
    for (let c = 0; c < frame[r].length; c++) {
      const currentAlpha = frame[r][c] ?? 0
      const previousAlpha = previous?.[r]?.[c] ?? 0
      const isNewOrBrighter = currentAlpha > previousAlpha
      const isMovingFrame = previous ? currentAlpha > 0 && previousAlpha === 0 : currentAlpha > 0
      next[r][c] = isNewOrBrighter || isMovingFrame ? currentAlpha : 0
    }
  }

  return next
}

export function applyTrailToFrames(
  frames: number[][][],
  trail: boolean | Set<string>
): number[][][] {
  const trailSet = trail instanceof Set ? trail : null
  if (!trailSet && !trail) return frames
  if (trailSet && trailSet.size === 0) return frames
  if (frames.length <= 1) return frames

  const trailLength = Math.min(5, Math.max(2, Math.ceil(frames.length / 4)))
  const motionFrames = frames.map((_, frameIndex) => motionFrame(frames, frameIndex))

  return frames.map((frame, frameIndex) => {
    const next = copyFrame(motionFrames[frameIndex])
    for (let offset = 1; offset <= trailLength; offset++) {
      const source = motionFrames[frameIndex - offset]
      if (!source) continue
      const strength = (trailLength - offset + 1) / (trailLength + 1)
      const opacity = strength * 0.62

      for (let r = 0; r < source.length; r++) {
        for (let c = 0; c < source[r].length; c++) {
          if (trailSet && !trailSet.has(`${r},${c}`)) continue
          next[r][c] = Math.max(next[r][c], source[r][c] * opacity)
        }
      }
    }
    return next
  })
}

export function presetToCustomPath(name: string, gridSize: number): CustomPathStep[] {
  const n = gridSize
  function step(pts: CustomPathPoint[]): CustomPathStep[] {
    if (pts.length === 0) return []
    return [{ cells: pts, buildAs: 'singles', play: 'one-by-one', timing: 'sequence', accumulate: true }]
  }

  switch (name) {
    case 'spiral': {
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
      return step(order.map(([r, c]) => ({ row: r, col: c })))
    }
    case 'corners':
      return step([
        { row: 0, col: 0 },
        { row: 0, col: n - 1 },
        { row: n - 1, col: 0 },
        { row: n - 1, col: n - 1 },
      ])
    case 'plus': {
      const mid = Math.floor(n / 2)
      const pts: CustomPathPoint[] = []
      for (let i = 0; i < n; i++) pts.push({ row: mid, col: i })
      for (let i = 0; i < n; i++) if (i !== mid) pts.push({ row: i, col: mid })
      return step(pts)
    }
    case 'triangle': {
      const pts: CustomPathPoint[] = []
      for (let r = 0; r < n; r++)
        for (let c = 0; c <= r; c++)
          pts.push({ row: r, col: c })
      return step(pts)
    }
    case 'wave-lr': {
      const step: CustomPathStep = {
        cells: [], buildAs: 'group', pattern: 'wave-lr', timing: 'sequence', play: 'one-by-one', accumulate: true
      }
      for (let c = 0; c < n; c++)
        for (let r = 0; r < n; r++)
          step.cells.push({ row: r, col: c })
      return [step]
    }
    case 'wave-tb': {
      const step: CustomPathStep = {
        cells: [], buildAs: 'group', pattern: 'wave-tb', timing: 'sequence', play: 'one-by-one'
      }
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++)
          step.cells.push({ row: r, col: c })
      return [step]
    }
    case 'wave-rl': {
      const step: CustomPathStep = {
        cells: [], buildAs: 'group', pattern: 'wave-rl', timing: 'sequence', play: 'one-by-one'
      }
      for (let c = n - 1; c >= 0; c--)
        for (let r = 0; r < n; r++)
          step.cells.push({ row: r, col: c })
      return [step]
    }
    case 'tl-br': {
      const pts: CustomPathPoint[] = []
      for (let i = 0; i < n; i++) pts.push({ row: i, col: i })
      return step(pts)
    }
    case 'i-left': {
      const mid = Math.floor(n / 2)
      const pts: CustomPathPoint[] = []
      for (let i = 0; i < n; i++) pts.push({ row: mid, col: i })
      return step(pts)
    }
    case 'left-right': {
      const pts: CustomPathPoint[] = []
      for (let i = 0; i < n; i++) {
        pts.push({ row: i, col: 0 })
        pts.push({ row: i, col: n - 1 })
      }
      return step(pts)
    }
    case 'striangle': {
      const pts: CustomPathPoint[] = []
      for (let c = 0; c < n; c++)
        for (let r = 0; r <= c; r++)
          pts.push({ row: r, col: c })
      return step(pts)
    }
    case 'scorners':
      return step([
        { row: 0, col: 0 },
        { row: 0, col: n - 1 },
        { row: Math.floor(n / 2), col: Math.floor(n / 2) },
        { row: n - 1, col: 0 },
        { row: n - 1, col: n - 1 },
        { row: Math.floor(n / 2), col: Math.floor(n / 2) },
      ])
    case 'pulse': {
      const step: CustomPathStep = {
        cells: [], buildAs: 'group', pattern: 'pulse', timing: 'sequence', play: 'one-by-one'
      }
      const mid = Math.floor(n / 2)
      for (let radius = 0; radius <= mid; radius++)
        for (let r = 0; r < n; r++)
          for (let c = 0; c < n; c++)
            if (Math.max(Math.abs(r - mid), Math.abs(c - mid)) === radius)
              step.cells.push({ row: r, col: c })
      return [step]
    }
    case 'diagonal': {
      const step: CustomPathStep = {
        cells: [], buildAs: 'group', pattern: 'diagonal', timing: 'sequence', play: 'one-by-one'
      }
      for (let offset = -(n - 1); offset < n; offset++)
        for (let r = 0; r < n; r++) {
          const c = r - offset
          if (c >= 0 && c < n) step.cells.push({ row: r, col: c })
        }
      return [step]
    }
    case 'fill': {
      const pts: CustomPathPoint[] = []
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++)
          pts.push({ row: r, col: c })
      return step(pts)
    }
    case 'snake': {
      const pts: CustomPathPoint[] = []
      for (let r = 0; r < n; r++) {
        if (r % 2 === 0) for (let c = 0; c < n; c++) pts.push({ row: r, col: c })
        else for (let c = n - 1; c >= 0; c--) pts.push({ row: r, col: c })
      }
      return step(pts)
    }
    case 'cross': {
      const pts: CustomPathPoint[] = []
      for (let i = 0; i < n; i++) {
        pts.push({ row: i, col: i })
        pts.push({ row: i, col: n - 1 - i })
      }
      return step(pts)
    }
    case 'checkerboard': {
      const pts: CustomPathPoint[] = []
      for (let sum = 0; sum <= (n - 1) * 2; sum++)
        for (let r = 0; r < n; r++) {
          const c = sum - r
          if (c >= 0 && c < n) pts.push({ row: r, col: c })
        }
      return step(pts)
    }
    case 'zigzag': {
      const pts: CustomPathPoint[] = []
      for (let c = 0; c < n; c++) {
        if (c % 2 === 0)
          for (let r = 0; r < n; r++) pts.push({ row: r, col: c })
        else
          for (let r = n - 1; r >= 0; r--) pts.push({ row: r, col: c })
      }
      return step(pts)
    }
    case 'rings': {
      const pts: CustomPathPoint[] = []
      const mid = Math.floor(n / 2)
      for (let radius = 0; radius <= mid; radius++)
        for (let r = 0; r < n; r++)
          for (let c = 0; c < n; c++)
            if (Math.max(Math.abs(r - mid), Math.abs(c - mid)) === radius)
              pts.push({ row: r, col: c })
      return step(pts)
    }
    case 'hourglass': {
      const pts: CustomPathPoint[] = []
      for (let i = 0; i < n; i++) {
        pts.push({ row: i, col: i })
        pts.push({ row: i, col: n - 1 - i })
      }
      for (let i = n - 1; i >= 0; i--) {
        pts.push({ row: n - 1 - i, col: Math.floor(n / 2) })
        pts.push({ row: Math.floor(n / 2), col: i })
      }
      return step(pts)
    }
    case 'arrows': {
      const pts: CustomPathPoint[] = []
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++)
          if (c === r || c === n - 1 - r || r === 0 || c === 0 || r === n - 1 || c === n - 1)
            pts.push({ row: r, col: c })
      return step(pts)
    }
    case 'random': {
      const pts: CustomPathPoint[] = []
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++)
          pts.push({ row: r, col: c })
      let seed = 42
      function next() {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        return seed / 0x7fffffff
      }
      for (let i = pts.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [pts[i], pts[j]] = [pts[j], pts[i]]
      }
      return step(pts)
    }
    default:
      return []
  }
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

  checkerboard: (n) => {
    const pts: CustomPathPoint[] = []
    for (let sum = 0; sum <= (n - 1) * 2; sum++)
      for (let r = 0; r < n; r++) {
        const c = sum - r
        if (c >= 0 && c < n) pts.push({ row: r, col: c })
      }
    return pathToFrames(pts.map(pointToStep), n)
  },

  zigzag: (n) => {
    const pts: CustomPathPoint[] = []
    for (let c = 0; c < n; c++) {
      if (c % 2 === 0)
        for (let r = 0; r < n; r++) pts.push({ row: r, col: c })
      else
        for (let r = n - 1; r >= 0; r--) pts.push({ row: r, col: c })
    }
    return pathToFrames(pts.map(pointToStep), n)
  },

  rings: (n) => {
    const pts: CustomPathPoint[] = []
    const mid = Math.floor(n / 2)
    for (let radius = 0; radius <= mid; radius++)
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++)
          if (Math.max(Math.abs(r - mid), Math.abs(c - mid)) === radius)
            pts.push({ row: r, col: c })
    return pathToFrames(pts.map(pointToStep), n)
  },

  hourglass: (n) => {
    const pts: CustomPathPoint[] = []
    for (let i = 0; i < n; i++) {
      pts.push({ row: i, col: i })
      pts.push({ row: i, col: n - 1 - i })
    }
    for (let i = n - 1; i >= 0; i--) {
      pts.push({ row: n - 1 - i, col: Math.floor(n / 2) })
      pts.push({ row: Math.floor(n / 2), col: i })
    }
    return pathToFrames(pts.map(pointToStep), n)
  },

  arrows: (n) => {
    const pts: CustomPathPoint[] = []
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        if (c === r || c === n - 1 - r || r === 0 || c === 0 || r === n - 1 || c === n - 1)
          pts.push({ row: r, col: c })
    return pathToFrames(pts.map(pointToStep), n)
  },

  random: (n) => {
    const pts: CustomPathPoint[] = []
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        pts.push({ row: r, col: c })
    let seed = 42
    function next() {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [pts[i], pts[j]] = [pts[j], pts[i]]
    }
    return pathToFrames(pts.map(pointToStep), n)
  },
}

export const presetNames = Object.keys(patternGenerators)
