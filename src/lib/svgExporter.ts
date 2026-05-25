import type { LoaderOptions, CustomPathStep, CellShape } from './types'
import { getGridCellPosition, getGridLayoutBounds } from './layouts'

function k(r: number, c: number) {
  return `${r},${c}`
}

export function generateLoaderSVG(
  options: LoaderOptions,
  frames: number[][][],
  customPath?: CustomPathStep[],
  hiddenCells?: string[]
): string {
  const { gridSize, cellSize, gap, color: defaultColor, speed, shape: defaultShape, glow: defaultGlow, gridLayout } = options
  const bounds = getGridLayoutBounds(cellSize, gap, gridSize, gridLayout)
  const totalSize = bounds.width
  const dur = frames.length / speed
  const hiddenSet = new Set(hiddenCells ?? [])

  const cellColors = buildColorMap(customPath, defaultColor)
  const cellShapes = buildShapeMap(customPath, defaultShape)
  const cellGlows = buildGlowMap(customPath, defaultGlow)

  const cellFrames: Map<string, number[]> = new Map()
  for (let f = 0; f < frames.length; f++) {
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const key = k(r, c)
        if (hiddenSet.has(key)) continue
        const alpha = frames[f][r]?.[c] ?? 0
        if (alpha > 0 || f === 0) {
          if (!cellFrames.has(key)) cellFrames.set(key, [])
          cellFrames.get(key)!.push(alpha)
        } else if (cellFrames.has(key)) {
          cellFrames.get(key)!.push(alpha)
        }
      }
    }
  }

  const animatedCells: { key: string; r: number; c: number; values: number[] }[] = []
  for (const [key, values] of cellFrames) {
    if (values.some((v) => v > 0)) {
      const [r, c] = key.split(',').map(Number)
      while (values.length < frames.length) values.push(0)
      animatedCells.push({ key, r, c, values })
    }
  }

  const usedGlows = new Set<number>()
  for (const cell of animatedCells) {
    usedGlows.add(cellGlows.get(cell.key) ?? defaultGlow)
  }

  let defs = ''
  for (const g of usedGlows) {
    if (g <= 0) continue
    defs += `
    <filter id="glow-${g}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${(g / 3).toFixed(1)}" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>`
  }

  let shapes = ''
  for (const cell of animatedCells) {
    const pos = getGridCellPosition(cell.r, cell.c, cellSize, gap, gridSize, gridLayout)
    if (!pos.visible) continue
    const x = pos.x
    const y = pos.y
    const glow = cellGlows.get(cell.key) ?? defaultGlow
    const fillColor = cellColors.get(cell.key) ?? defaultColor
    const shape = cellShapes.get(cell.key) ?? defaultShape
    const values = cell.values.join(';')
    const h = cellSize / 2

    let shapeStr: string
    switch (shape) {
      case 'circle':
        shapeStr = `<circle cx="${x + h}" cy="${y + h}" r="${h}" fill="${fillColor}"${glow > 0 ? ` filter="url(#glow-${glow})"` : ''}>
        <animate attributeName="opacity" values="${values}" dur="${dur}s" repeatCount="indefinite"/>
      </circle>`
        break
      case 'diamond':
        shapeStr = `<polygon points="${x + h},${y} ${x + cellSize},${y + h} ${x + h},${y + cellSize} ${x},${y + h}" fill="${fillColor}"${glow > 0 ? ` filter="url(#glow-${glow})"` : ''}>
        <animate attributeName="opacity" values="${values}" dur="${dur}s" repeatCount="indefinite"/>
      </polygon>`
        break
      case 'triangle':
        shapeStr = `<polygon points="${x + h},${y} ${x + cellSize},${y + cellSize} ${x},${y + cellSize}" fill="${fillColor}"${glow > 0 ? ` filter="url(#glow-${glow})"` : ''}>
        <animate attributeName="opacity" values="${values}" dur="${dur}s" repeatCount="indefinite"/>
      </polygon>`
        break
      case 'hexagon': {
        const hex: string[] = []
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 6
          hex.push(`${(x + h + h * Math.cos(a)).toFixed(1)},${(y + h + h * Math.sin(a)).toFixed(1)}`)
        }
        shapeStr = `<polygon points="${hex.join(' ')}" fill="${fillColor}"${glow > 0 ? ` filter="url(#glow-${glow})"` : ''}>
        <animate attributeName="opacity" values="${values}" dur="${dur}s" repeatCount="indefinite"/>
      </polygon>`
        break
      }
      default:
        shapeStr = `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${fillColor}"${glow > 0 ? ` filter="url(#glow-${glow})"` : ''}>
        <animate attributeName="opacity" values="${values}" dur="${dur}s" repeatCount="indefinite"/>
      </rect>`
    }
    shapes += `\n    ${shapeStr}`
  }

  return `<svg viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}" xmlns="http://www.w3.org/2000/svg">
  ${defs ? `<defs>${defs}
  </defs>` : ''}
  <rect width="100%" height="100%" fill="transparent"/>${shapes}
</svg>`
}

function buildColorMap(path: CustomPathStep[] | undefined, defaultColor: string): Map<string, string> {
  const m = new Map<string, string>()
  if (!path) return m
  for (const step of path) {
    const cells = [step.cells, ...(step.tracks?.map((track) => track.cells) ?? [])].flat()
    for (const c of cells) {
      const col = c.color ?? step.color
      if (col && col !== defaultColor) m.set(k(c.row, c.col), col)
    }
  }
  return m
}

function buildShapeMap(path: CustomPathStep[] | undefined, defaultShape: CellShape): Map<string, CellShape> {
  const m = new Map<string, CellShape>()
  if (!path) return m
  for (const step of path) {
    const cells = [step.cells, ...(step.tracks?.map((track) => track.cells) ?? [])].flat()
    for (const c of cells) {
      const s = c.shape ?? step.shape
      if (s && s !== defaultShape) m.set(k(c.row, c.col), s)
    }
  }
  return m
}

function buildGlowMap(path: CustomPathStep[] | undefined, defaultGlow: number): Map<string, number> {
  const m = new Map<string, number>()
  if (!path) return m
  for (const step of path) {
    const cells = [step.cells, ...(step.tracks?.map((track) => track.cells) ?? [])].flat()
    for (const c of cells) {
      const g = c.glow ?? step.glow ?? defaultGlow
      if (g > 0) m.set(k(c.row, c.col), g)
    }
  }
  return m
}
