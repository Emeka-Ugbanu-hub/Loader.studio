import type { CellShape, GridLayout } from './types'

export interface VisualCell {
  row: number
  col: number
  x: number
  y: number
  visible: boolean
  orientation?: 'up' | 'down'
}

export interface VisualGrid {
  cells: VisualCell[]
  width: number
  height: number
}

function visualCellKey(row: number, col: number) {
  return `${row},${col}`
}

export function getCellMap(grid: VisualGrid) {
  return new Map(grid.cells.map((cell) => [visualCellKey(cell.row, cell.col), cell]))
}

export function layoutCellShape(layout: GridLayout, shape: CellShape): CellShape {
  if (layout === 'hive') return 'hexagon'
  if (layout === 'circular') return 'circle'
  if (layout === 'isometric') return 'diamond'
  if (layout === 'triangular') return 'triangle'
  return shape
}

export function getVisualGrid(
  layout: GridLayout | undefined,
  gridSize: number,
  cellSize: number,
  gap: number,
): VisualGrid {
  switch (layout) {
    case 'hive':
      return getHiveGrid(gridSize, cellSize, gap)
    case 'circular':
      return getCircularGrid(gridSize, cellSize, gap)
    case 'isometric':
      return getIsometricGrid(gridSize, cellSize, gap)
    case 'triangular':
      return getTriangularGrid(gridSize, cellSize, gap)
    default:
      return getMatrixGrid(gridSize, cellSize, gap)
  }
}

function getMatrixGrid(gridSize: number, cellSize: number, gap: number): VisualGrid {
  const step = cellSize + gap
  const cells: VisualCell[] = []

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      cells.push({
        row,
        col,
        x: col * step,
        y: row * step,
        visible: true,
      })
    }
  }

  const size = gridSize * step - gap
  return { cells, width: size, height: size }
}

function getHiveGrid(gridSize: number, cellSize: number, gap: number): VisualGrid {
  const radius = Math.max(1, Math.floor((gridSize - 1) / 2))
  const center = radius
  const centerGap = gap * 0.72
  const stepX = cellSize * 0.86 + centerGap
  const stepY = cellSize * 0.74 + centerGap
  const rawCells: VisualCell[] = []

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const axialR = row - center
      const axialQ = col - center
      const visible = Math.abs(axialQ) <= radius
        && Math.abs(axialR) <= radius
        && Math.abs(axialQ + axialR) <= radius

      rawCells.push({
        row,
        col,
        visible,
        x: (axialQ + axialR / 2) * stepX,
        y: axialR * stepY,
      })
    }
  }

  return normalizeGrid(rawCells, cellSize, true)
}

function getCircularGrid(gridSize: number, cellSize: number, gap: number): VisualGrid {
  const step = cellSize + gap
  const center = (gridSize - 1) / 2
  const maxRings = Math.ceil(gridSize / 2)
  const rawCells: VisualCell[] = []

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      rawCells.push({ row, col, x: 0, y: 0, visible: false })
    }
  }

  const ringPositions: { x: number; y: number }[] = []
  for (let ring = 0; ring <= maxRings; ring++) {
    const cellCount = ring === 0 ? 1 : Math.max(6, Math.round(2 * Math.PI * ring * 0.7))
    for (let i = 0; i < cellCount; i++) {
      const angle = (2 * Math.PI * i) / cellCount - Math.PI / 2
      ringPositions.push({
        x: center * step + Math.cos(angle) * ring * step,
        y: center * step + Math.sin(angle) * ring * step,
      })
    }
  }

  const used = new Set<number>()
  for (const pos of ringPositions) {
    let bestIdx = -1
    let bestDist = Infinity
    for (let i = 0; i < rawCells.length; i++) {
      if (used.has(i)) continue
      const r = Math.floor(i / gridSize)
      const c = i % gridSize
      const cx = c * step + cellSize / 2
      const cy = r * step + cellSize / 2
      const d = Math.abs(cx - pos.x) + Math.abs(cy - pos.y)
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }
    if (bestIdx >= 0) {
      used.add(bestIdx)
      rawCells[bestIdx] = {
        row: Math.floor(bestIdx / gridSize),
        col: bestIdx % gridSize,
        x: pos.x - cellSize / 2,
        y: pos.y - cellSize / 2,
        visible: true,
      }
    }
  }

  return normalizeGrid(rawCells, cellSize, true)
}

function getIsometricGrid(gridSize: number, cellSize: number, gap: number): VisualGrid {
  const stepX = cellSize * 0.52 + gap
  const stepY = cellSize * 0.52 + gap
  const rawCells: VisualCell[] = []

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      rawCells.push({
        row,
        col,
        x: (col - row) * stepX,
        y: (col + row) * stepY,
        visible: true,
      })
    }
  }

  return normalizeGrid(rawCells, cellSize)
}

function getTriangularGrid(gridSize: number, cellSize: number, gap: number): VisualGrid {
  const stepX = cellSize * 0.5 + gap
  const stepY = cellSize + gap
  const rawCells: VisualCell[] = []
  const cellCount = gridSize * gridSize

  for (let index = 0; index < cellCount; index++) {
    const row = Math.floor(index / gridSize)
    const col = index % gridSize
    const visualRow = Math.floor(Math.sqrt(index))
    const visualCol = index - visualRow * visualRow
    const rowWidth = visualRow * 2 + 1
    const rowOffset = ((gridSize * 2 - 1 - rowWidth) * stepX) / 2

    rawCells.push({
      row,
      col,
      x: rowOffset + visualCol * stepX,
      y: visualRow * stepY,
      visible: true,
      orientation: visualCol % 2 === 0 ? 'up' : 'down',
    })
  }

  return normalizeGrid(rawCells, cellSize)
}

function normalizeGrid(rawCells: VisualCell[], cellSize: number, square = false): VisualGrid {
  const visibleCells = rawCells.filter((cell) => cell.visible)
  const minX = Math.min(...visibleCells.map((cell) => cell.x))
  const minY = Math.min(...visibleCells.map((cell) => cell.y))
  const maxX = Math.max(...visibleCells.map((cell) => cell.x + cellSize))
  const maxY = Math.max(...visibleCells.map((cell) => cell.y + cellSize))
  const width = maxX - minX
  const height = maxY - minY
  const size = Math.max(width, height)
  const padX = square ? (size - width) / 2 : 0
  const padY = square ? (size - height) / 2 : 0

  return {
    cells: rawCells.map((cell) => ({
      ...cell,
      x: cell.x - minX + padX,
      y: cell.y - minY + padY,
    })),
    width: square ? size : width,
    height: square ? size : height,
  }
}
