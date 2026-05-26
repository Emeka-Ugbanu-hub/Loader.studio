import type { CellShape, CustomPathPoint, CustomPathStep } from './types'

export const SHAPES: CellShape[] = ['square', 'circle', 'diamond', 'triangle', 'hexagon']

export function cellKey(r: number, c: number): string {
  return `${r},${c}`
}

export function getStepCells(step: CustomPathStep): CustomPathPoint[] {
  return [step.cells, ...(step.tracks?.map((track) => track.cells) ?? [])].flat()
}

export function cellAlpha(cell: CustomPathPoint, fallback?: number): number {
  return cell.opacity ?? fallback ?? 100
}

export function extractCellProps(path: CustomPathStep[]): {
  colors: Map<string, string>
  shapes: Map<string, CellShape>
  glows: Map<string, number>
  sizes: Map<string, number>
} {
  const colors = new Map<string, string>()
  const shapes = new Map<string, CellShape>()
  const glows = new Map<string, number>()
  const sizes = new Map<string, number>()

  for (const step of path) {
    const cells = getStepCells(step)
    for (const c of cells) {
      const key = cellKey(c.row, c.col)
      if (c.color) colors.set(key, c.color)
      if (c.shape) shapes.set(key, c.shape)
      const g = c.glow ?? step.glow
      if (g != null && g > 0) glows.set(key, g)
      const s = c.size ?? step.size
      if (s != null && s !== 1) sizes.set(key, s)
    }
  }

  return { colors, shapes, glows, sizes }
}
