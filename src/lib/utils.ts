import type { CellShape, CustomAnimationUnit, CustomPathPoint, CustomPathStep } from './types'

export const SHAPES: CellShape[] = ['square', 'circle', 'diamond', 'triangle', 'hexagon']

export function cellKey(r: number, c: number): string {
  return `${r},${c}`
}

export function getStepCells(step: CustomPathStep): CustomPathPoint[] {
  if (step.units?.length) return step.units.flatMap((unit) => unit.cells)
  return [step.cells, ...(step.tracks?.map((track) => track.cells) ?? [])].flat()
}

export function getStepUnits(step: CustomPathStep): CustomAnimationUnit[] {
  if (step.units?.length) return step.units.filter((unit) => unit.cells.length > 0)

  const cells = getStepCells(step)
  if (step.buildAs === 'group') return cells.length > 0 ? [{ cells }] : []
  return cells.map((cell) => ({ cells: [cell] }))
}

export function cellAlpha(cell: CustomPathPoint, fallback?: number): number {
  return cell.opacity ?? fallback ?? 100
}

export function extractCellProps(path: CustomPathStep[]): {
  colors: Map<string, string>
  trailColors: Map<string, string>
  shapes: Map<string, CellShape>
  glows: Map<string, number>
  sizes: Map<string, number>
} {
  const colors = new Map<string, string>()
  const trailColors = new Map<string, string>()
  const shapes = new Map<string, CellShape>()
  const glows = new Map<string, number>()
  const sizes = new Map<string, number>()

  for (const step of path) {
    const startKeys = new Set(step.startCells?.map((cell) => cellKey(cell.row, cell.col)) ?? [])
    const hasGroupedStart = getStepUnits(step).some((unit) => (
      unit.cells.length > 1 && unit.cells.some((cell) => startKeys.has(cellKey(cell.row, cell.col)))
    ))
    const cells = getStepCells(step)
    for (const c of cells) {
      const key = cellKey(c.row, c.col)
      const color = c.color ?? (hasGroupedStart ? step.color : undefined)
      const trailColor = c.trailColor ?? step.trailColor ?? color
      if (color) colors.set(key, color)
      if (trailColor) trailColors.set(key, trailColor)
      if (c.shape) shapes.set(key, c.shape)
      const g = c.glow ?? step.glow
      if (g != null && g > 0) glows.set(key, g)
      const s = c.size ?? step.size
      if (s != null && s !== 1) sizes.set(key, s)
    }
  }

  return { colors, trailColors, shapes, glows, sizes }
}
