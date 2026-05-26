import type { LoaderOptions, CustomPathStep } from './types'
import { getCellMap, getVisualGrid, layoutCellShape } from './gridLayout'
import { cellKey, extractCellProps } from './utils'

export function generateLoaderSVG(
  options: LoaderOptions,
  frames: number[][][],
  customPath?: CustomPathStep[],
  hiddenCells?: string[]
): string {
  const { gridSize, cellSize, gap, color: defaultColor, speed, glow: defaultGlow, layout = 'matrix' } = options
  const defaultShape = layoutCellShape(layout, options.shape)
  const visualGrid = getVisualGrid(layout, gridSize, cellSize, gap)
  const cellMap = getCellMap(visualGrid)
  const dur = frames.length / speed
  const hiddenSet = new Set(hiddenCells ?? [])

  const props = customPath ? extractCellProps(customPath) : { colors: new Map(), shapes: new Map(), glows: new Map(), sizes: new Map() }
  const cellColors = props.colors
  const cellShapes = props.shapes
  const cellGlows = props.glows
  const cellSizes = props.sizes

  const cellFrames: Map<string, number[]> = new Map()
  for (let f = 0; f < frames.length; f++) {
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const key = cellKey(r, c)
        const visualCell = cellMap.get(key)
        if (!visualCell?.visible) continue
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
    const visualCell = cellMap.get(cell.key)
    if (!visualCell?.visible) continue
    const x = visualCell.x
    const y = visualCell.y
    const glow = cellGlows.get(cell.key) ?? defaultGlow
    const fillColor = cellColors.get(cell.key) ?? defaultColor
    const shape = cellShapes.get(cell.key) ?? defaultShape
    const size = cellSizes.get(cell.key) ?? 1
    const values = cell.values.join(';')
    const h = cellSize / 2
    const cx = x + h
    const cy = y + h

    const gOpen = size !== 1 ? `<g transform="translate(${cx} ${cy}) scale(${size}) translate(${-cx} ${-cy})">` : ''
    const gClose = size !== 1 ? '</g>' : ''
    let shapeStr: string
    switch (shape) {
      case 'circle':
        shapeStr = `${gOpen}<circle cx="${x + h}" cy="${y + h}" r="${h}" fill="${fillColor}"${glow > 0 ? ` filter="url(#glow-${glow})"` : ''}>
        <animate attributeName="opacity" values="${values}" dur="${dur}s" repeatCount="indefinite"/>
      </circle>${gClose}`
        break
      case 'diamond':
        shapeStr = `${gOpen}<polygon points="${x + h},${y} ${x + cellSize},${y + h} ${x + h},${y + cellSize} ${x},${y + h}" fill="${fillColor}"${glow > 0 ? ` filter="url(#glow-${glow})"` : ''}>
        <animate attributeName="opacity" values="${values}" dur="${dur}s" repeatCount="indefinite"/>
      </polygon>${gClose}`
        break
      case 'triangle':
        shapeStr = visualCell.orientation === 'down'
          ? `${gOpen}<polygon points="${x},${y} ${x + cellSize},${y} ${x + h},${y + cellSize}" fill="${fillColor}"${glow > 0 ? ` filter="url(#glow-${glow})"` : ''}>
        <animate attributeName="opacity" values="${values}" dur="${dur}s" repeatCount="indefinite"/>
      </polygon>${gClose}`
          : `${gOpen}<polygon points="${x + h},${y} ${x + cellSize},${y + cellSize} ${x},${y + cellSize}" fill="${fillColor}"${glow > 0 ? ` filter="url(#glow-${glow})"` : ''}>
        <animate attributeName="opacity" values="${values}" dur="${dur}s" repeatCount="indefinite"/>
      </polygon>${gClose}`
        break
      case 'hexagon': {
        const hex: string[] = []
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 6
          hex.push(`${(x + h + h * Math.cos(a)).toFixed(1)},${(y + h + h * Math.sin(a)).toFixed(1)}`)
        }
        shapeStr = `${gOpen}<polygon points="${hex.join(' ')}" fill="${fillColor}"${glow > 0 ? ` filter="url(#glow-${glow})"` : ''}>
        <animate attributeName="opacity" values="${values}" dur="${dur}s" repeatCount="indefinite"/>
      </polygon>${gClose}`
        break
      }
      default:
        shapeStr = `${gOpen}<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${fillColor}"${glow > 0 ? ` filter="url(#glow-${glow})"` : ''}>
        <animate attributeName="opacity" values="${values}" dur="${dur}s" repeatCount="indefinite"/>
      </rect>${gClose}`
    }
    shapes += `\n    ${shapeStr}`
  }

  return `<svg viewBox="0 0 ${visualGrid.width} ${visualGrid.height}" width="${visualGrid.width}" height="${visualGrid.height}" xmlns="http://www.w3.org/2000/svg">
  ${defs ? `<defs>${defs}
  </defs>` : ''}
  <rect width="100%" height="100%" fill="transparent"/>${shapes}
</svg>`
}
