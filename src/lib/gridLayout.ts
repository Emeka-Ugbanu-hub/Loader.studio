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

export function layoutCellShape(_layout: GridLayout, shape: CellShape): CellShape {
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
  const spacing = cellSize + gap
  const targetCount = Math.min(gridSize * gridSize, Math.max(7, Math.round(gridSize * gridSize * 0.42)))
  const positions: { x: number; y: number }[] = []

  positions.push({ x: 0, y: 0 })

  let ring = 1
  while (positions.length < targetCount) {
    const radius = ring * spacing
    const ringCount = Math.max(6, Math.round(2 * Math.PI * ring))
    if (positions.length + ringCount > targetCount) break

    for (let i = 0; i < ringCount; i++) {
      const angle = (2 * Math.PI * i) / ringCount - Math.PI / 2
      positions.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      })
    }

    ring++
  }

  const remaining = targetCount - positions.length
  if (remaining >= 6) {
    const radius = ring * spacing
    for (let i = 0; i < remaining; i++) {
      const angle = (2 * Math.PI * i) / remaining - Math.PI / 2
      positions.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      })
    }
  }

  const rawCells: VisualCell[] = []
  for (let i = 0; i < gridSize * gridSize; i++) {
    const p = positions[i]
    const r = Math.floor(i / gridSize)
    const c = i % gridSize
    rawCells.push({
      row: r,
      col: c,
      x: (p?.x ?? 0) - cellSize / 2,
      y: (p?.y ?? 0) - cellSize / 2,
      visible: Boolean(p),
    })
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
