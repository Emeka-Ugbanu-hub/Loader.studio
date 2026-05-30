import type { CustomAnimationUnit, CustomParallelTrack, CustomPathPoint, CustomPathStep, MovementPattern } from './types'
import { PRESET_GEOMETRIES, presetToCustomPath } from './presets'
import { getStepCells, getStepUnits } from './utils'

export { presetToCustomPath }

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

function unitCenter(unit: CustomAnimationUnit): { row: number; col: number } {
  const total = unit.cells.reduce((acc, cell) => ({
    row: acc.row + cell.row,
    col: acc.col + cell.col,
  }), { row: 0, col: 0 })
  const count = Math.max(1, unit.cells.length)
  return { row: total.row / count, col: total.col / count }
}

function getPatternUnitGroups(units: CustomAnimationUnit[], pattern: MovementPattern): CustomAnimationUnit[][] {
  const keyed = new Map<number, CustomAnimationUnit[]>()
  const rows = units.flatMap((unit) => unit.cells.map((cell) => cell.row))
  const cols = units.flatMap((unit) => unit.cells.map((cell) => cell.col))
  const mr = rows.length ? (Math.min(...rows) + Math.max(...rows)) / 2 : 0
  const mc = cols.length ? (Math.min(...cols) + Math.max(...cols)) / 2 : 0

  const keyFn = (unit: CustomAnimationUnit): number => {
    const center = unitCenter(unit)
    switch (pattern) {
      case 'wave-lr': return center.col
      case 'wave-rl': return -center.col
      case 'wave-tb': return center.row
      case 'wave-bt': return -center.row
      case 'diagonal': return center.row + center.col
      case 'pulse': return Math.max(Math.abs(center.row - mr), Math.abs(center.col - mc))
    }
  }

  for (const unit of units) {
    const key = keyFn(unit)
    if (!keyed.has(key)) keyed.set(key, [])
    keyed.get(key)!.push(unit)
  }

  return Array.from(keyed.entries()).sort((a, b) => a[0] - b[0]).map((entry) => entry[1])
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

function applyUnitToFrame(frame: number[][], unit: CustomAnimationUnit, stepFallback?: number) {
  for (const cell of unit.cells) {
    if (!frame[cell.row]?.[cell.col]) {
      if (frame[cell.row]?.[cell.col] !== 0) continue
    }
    frame[cell.row][cell.col] = Math.max(frame[cell.row][cell.col], cellAlpha(cell, stepFallback))
  }
}

function unitBounds(unit: CustomAnimationUnit) {
  const rows = unit.cells.map((cell) => cell.row)
  const cols = unit.cells.map((cell) => cell.col)
  return {
    minRow: Math.min(...rows),
    maxRow: Math.max(...rows),
    minCol: Math.min(...cols),
    maxCol: Math.max(...cols),
  }
}

function matchingStartUnit(step: CustomPathStep): CustomAnimationUnit | null {
  const startKeys = new Set(step.startCells?.map(keyForCell) ?? [])
  if (startKeys.size === 0) return null

  return getStepUnits(step).find((unit) => (
    unit.cells.length > 1 && unit.cells.some((cell) => startKeys.has(keyForCell(cell)))
  )) ?? null
}

function footprintFramesForStep(step: CustomPathStep, gridSize: number): number[][][] | null {
  if (!step.pattern || !['wave-lr', 'wave-rl', 'wave-tb', 'wave-bt'].includes(step.pattern)) return null

  const startUnit = matchingStartUnit(step)
  if (!startUnit) return null

  const bounds = unitBounds(startUnit)
  const width = bounds.maxCol - bounds.minCol + 1
  const height = bounds.maxRow - bounds.minRow + 1
  const maxColStart = Math.max(0, gridSize - width)
  const maxRowStart = Math.max(0, gridSize - height)
  const horizontal = step.pattern === 'wave-lr' || step.pattern === 'wave-rl'
  const start = horizontal ? bounds.minCol : bounds.minRow
  const end = horizontal
    ? (step.pattern === 'wave-lr' ? maxColStart : 0)
    : (step.pattern === 'wave-tb' ? maxRowStart : 0)
  const direction = end >= start ? 1 : -1
  const frameCount = Math.abs(end - start) + 1
  const footprintOffsets = startUnit.cells.map((cell) => ({
    row: cell.row - bounds.minRow,
    col: cell.col - bounds.minCol,
    alpha: cellAlpha(cell, step.opacity),
  }))

  return Array.from({ length: frameCount }, (_, frameIndex) => {
    const frame = emptyGrid(gridSize)
    const origin = start + direction * frameIndex
    for (const cell of footprintOffsets) {
      const row = horizontal ? bounds.minRow + cell.row : origin + cell.row
      const col = horizontal ? origin + cell.col : bounds.minCol + cell.col
      if (row < 0 || row >= gridSize || col < 0 || col >= gridSize) continue
      frame[row][col] = Math.max(frame[row][col], cell.alpha)
    }
    return frame
  })
}

function unitsToSequenceFrames(units: CustomAnimationUnit[], gridSize: number, stepFallback?: number): number[][][] {
  const frames: number[][][] = []
  const revealed = new Map<string, number>()

  for (const unit of units) {
    for (const c of unit.cells) revealed.set(`${c.row},${c.col}`, cellAlpha(c, stepFallback))
    frames.push(frameFromRevealed(revealed, gridSize))
  }

  return frames.length > 0 ? frames : [emptyGrid(gridSize)]
}

function orderedUnitsForStep(step: CustomPathStep): CustomAnimationUnit[] {
  const units = getStepUnits(step)
  if (!step.pattern || units.length <= 1) return units
  return getPatternUnitGroups(units, step.pattern).flat()
}

function keyForCell(cell: CustomPathPoint): string {
  return `${cell.row},${cell.col}`
}

function startIndexesForStep(step: CustomPathStep, units: CustomAnimationUnit[]): number[] {
  const startCells = step.startCells?.filter(Boolean) ?? []
  const unitHasStart = (unit: CustomAnimationUnit, startCell: CustomPathPoint) => (
    unit.cells.some((cell) => keyForCell(cell) === keyForCell(startCell))
  )
  const indexes = startCells
    .map((startCell) => units.findIndex((unit) => unitHasStart(unit, startCell)))
    .filter((index) => index >= 0)

  return Array.from(new Set(indexes)).length > 0 ? Array.from(new Set(indexes)) : [0]
}

function directionForStart(startIndex: number, length: number): 1 | -1 {
  return startIndex >= (length - 1) / 2 ? -1 : 1
}

function cellsToWindowFrames(step: CustomPathStep, gridSize: number): number[][][] {
  const footprintFrames = footprintFramesForStep(step, gridSize)
  if (footprintFrames) return footprintFrames

  const units = orderedUnitsForStep(step)
  if (units.length === 0) return [emptyGrid(gridSize)]

  const startIndexes = startIndexesForStep(step, units)
  const activeCount = Math.max(1, Math.min(step.activeCount ?? 1, units.length))
  const longest = Math.max(...startIndexes.map((startIndex) => {
    const direction = directionForStart(startIndex, units.length)
    return direction === 1 ? units.length - startIndex : startIndex + 1
  }))

  return Array.from({ length: longest }, (_, frameIndex) => {
    const frame = emptyGrid(gridSize)

    for (const startIndex of startIndexes) {
      const direction = directionForStart(startIndex, units.length)
      for (let offset = 0; offset < activeCount; offset++) {
        const unitIndex = startIndex + direction * (frameIndex + offset)
        const unit = units[unitIndex]
        if (!unit) continue
        applyUnitToFrame(frame, unit, step.opacity)
      }
    }

    return frame
  })
}

function cellsToFillFramesFromStarts(step: CustomPathStep, gridSize: number): number[][][] {
  const units = orderedUnitsForStep(step)
  if (units.length === 0) return [emptyGrid(gridSize)]

  const startIndexes = startIndexesForStep(step, units)
  const longest = Math.max(...startIndexes.map((startIndex) => {
    const direction = directionForStart(startIndex, units.length)
    return direction === 1 ? units.length - startIndex : startIndex + 1
  }))
  const revealed = new Map<string, number>()

  return Array.from({ length: longest }, (_, frameIndex) => {
    for (const startIndex of startIndexes) {
      const direction = directionForStart(startIndex, units.length)
      const unit = units[startIndex + direction * frameIndex]
      if (!unit) continue
      for (const cell of unit.cells) {
        revealed.set(keyForCell(cell), Math.max(revealed.get(keyForCell(cell)) ?? 0, cellAlpha(cell, step.opacity)))
      }
    }

    return frameFromRevealed(revealed, gridSize)
  })
}

function unitsToTogetherFrame(units: CustomAnimationUnit[], gridSize: number, stepFallback?: number): number[][][] {
  const frame = emptyGrid(gridSize)
  for (const unit of units) applyUnitToFrame(frame, unit, stepFallback)
  return [frame]
}

function layerToFrames(step: CustomPathStep, gridSize: number): number[][][] {
  const units = getStepUnits(step)
  if (units.length === 0) return [emptyGrid(gridSize)]

  if (step.buildAs === 'singles') {
    if (step.play === 'together') {
      return unitsToTogetherFrame(units, gridSize, step.opacity)
    }
    const motionMode = step.motionMode ?? (step.accumulate === false ? 'window' : 'fill')
    return motionMode === 'window'
      ? cellsToWindowFrames(step, gridSize)
      : cellsToFillFramesFromStarts(step, gridSize)
  }

  if (step.play === 'together') {
    return unitsToTogetherFrame(units, gridSize, step.opacity)
  }

  const motionMode = step.motionMode ?? (step.accumulate === false ? 'window' : 'fill')
  if (motionMode === 'window') return cellsToWindowFrames(step, gridSize)
  if (step.startCells && step.startCells.length > 0) return cellsToFillFramesFromStarts(step, gridSize)

  if (step.pattern) {
    const frames: number[][][] = []
    for (const group of getPatternUnitGroups(units, step.pattern)) {
      const frame = emptyGrid(gridSize)
      for (const unit of group) applyUnitToFrame(frame, unit, step.opacity)
      frames.push(frame)
    }
    return frames.length > 0 ? frames : [emptyGrid(gridSize)]
  }

  return unitsToSequenceFrames(units, gridSize, step.opacity)
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
  if ((layer.motionMode ?? (layer.accumulate === false ? 'window' : 'fill')) === 'window') return
  for (const c of getStepCells(layer)) revealed.set(`${c.row},${c.col}`, cellAlpha(c, layer.opacity))
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
  return pathToFrames(path, gridSize)
}

function keepTrailedUnits(step: CustomPathStep): CustomAnimationUnit[] {
  if (step.trail) return getStepUnits(step)

  return getStepUnits(step)
    .map((unit) => ({
      ...unit,
      cells: unit.cells.filter((cell) => cell.trail === true),
    }))
    .filter((unit) => unit.cells.length > 0)
}

function pathToTrailSource(path: CustomPathStep[]): CustomPathStep[] {
  return path.flatMap((step) => {
    const units = keepTrailedUnits(step)
    if (units.length === 0) return []
    const cells = units.flatMap((unit) => unit.cells)

    return [{
      ...step,
      cells,
      units,
      tracks: undefined,
    }]
  })
}

export function generateCustomTrailFrames(path: CustomPathStep[], gridSize: number): number[][][] {
  const trailPath = pathToTrailSource(path)
  if (trailPath.length === 0) return []
  return pathToFrames(trailPath, gridSize)
}

export function applyTrailToFrames(
  frames: number[][][],
  trail: boolean | Set<string> | { sourceFrames: number[][][]; cellKeys?: Set<string> }
): number[][][] {
  const trailSet = trail instanceof Set ? trail : 'cellKeys' in Object(trail) ? (trail as { cellKeys?: Set<string> }).cellKeys ?? null : null
  const sourceFrames = typeof trail === 'object' && !(trail instanceof Set) && 'sourceFrames' in trail
    ? trail.sourceFrames
    : frames
  if (!trailSet && !trail) return frames
  if (trailSet && trailSet.size === 0) return frames
  if (frames.length <= 1 || sourceFrames.length <= 1) return frames

  const trailLength = Math.min(5, Math.max(2, Math.ceil(frames.length / 4)))

  return frames.map((frame, frameIndex) => {
    const next = copyFrame(frame)
    for (let offset = 1; offset <= trailLength; offset++) {
      const source = sourceFrames[frameIndex - offset]
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


export const patternGenerators: Record<string, (n: number) => number[][][]> = {}

for (const [name, geo] of Object.entries(PRESET_GEOMETRIES)) {
  const gen = geo.points
  patternGenerators[name] = (n: number) => {
    const pts = gen(n)
    return pathToFrames(pts.map(pointToStep), n)
  }
}

export const presetNames = Object.keys(patternGenerators)
