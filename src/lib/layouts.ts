import type { GridLayout } from './types'

export interface GridCellPos {
  x: number
  y: number
  visible: boolean
}

export function getGridCellPosition(
  row: number,
  col: number,
  cellSize: number,
  gap: number,
  gridSize: number,
  layout: GridLayout
): GridCellPos {
  const step = cellSize + gap

  switch (layout) {
    case 'honeycomb': {
      const offsetX = (row % 2 === 1) ? step / 2 : 0
      return {
        x: col * step + offsetX,
        y: row * step * 0.866,
        visible: true,
      }
    }
    case 'circle': {
      const center = (gridSize - 1) / 2
      const dx = col - center
      const dy = row - center
      return {
        x: col * step,
        y: row * step,
        visible: Math.sqrt(dx * dx + dy * dy) <= center + 0.1,
      }
    }
    case 'triangle': {
      return {
        x: col * step,
        y: row * step,
        visible: col <= row + gridSize / 2 && col >= -row + gridSize / 2 - 1 && row < gridSize,
      }
    }
    case 'diamond': {
      const center = (gridSize - 1) / 2
      return {
        x: col * step,
        y: row * step,
        visible: Math.abs(col - center) + Math.abs(row - center) <= center + 0.1,
      }
    }
    case 'hex': {
      const center = (gridSize - 1) / 2
      const q = col - center
      const r = row - center
      return {
        x: col * step,
        y: row * step,
        visible: Math.abs(q) <= center && Math.abs(r) <= center && Math.abs(q + r) <= center + 0.1,
      }
    }
    default:
      return { x: col * step, y: row * step, visible: true }
  }
}

export function getGridLayoutBounds(
  cellSize: number,
  gap: number,
  gridSize: number,
  layout: GridLayout
): { width: number; height: number } {
  const step = cellSize + gap

  switch (layout) {
    case 'honeycomb':
      return {
        width: gridSize * step,
        height: (gridSize - 1) * step * 0.866 + cellSize,
      }
    default:
      return {
        width: gridSize * step - gap,
        height: gridSize * step - gap,
      }
  }
}
