export function getDisplayCellSize(gridSize: number, cellSize: number, availableSize: number) {
  return Math.floor(Math.min(availableSize / gridSize - 6, cellSize * 3.4))
}
