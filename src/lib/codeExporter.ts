import type { CustomPathStep, LoaderOptions } from './types'
import { cellKey, extractCellProps } from './utils'
import { getCellMap, getVisualGrid, layoutCellShape } from './gridLayout'

type ExportCell = {
  key: string
  row: number
  col: number
  x: number
  y: number
  values: number[]
  className: string
  inlineStyle: string
}

type BackgroundCell = {
  key: string
  className: string
  inlineStyle: string
}

function cssEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function buildAnimatedCells(
  options: LoaderOptions,
  frames: number[][][],
  customPath?: CustomPathStep[],
  hiddenCells?: string[]
) {
  const { gridSize, cellSize, gap, color: defaultColor, glow: defaultGlow, layout = 'matrix' } = options
  const defaultShape = layoutCellShape(layout, options.shape)
  const visualGrid = getVisualGrid(layout, gridSize, cellSize, gap)
  const cellMap = getCellMap(visualGrid)
  const hiddenSet = new Set(hiddenCells ?? [])
  const props = customPath ? extractCellProps(customPath) : { colors: new Map(), trailColors: new Map(), shapes: new Map(), glows: new Map(), sizes: new Map() }

  const cellFrames = new Map<string, number[]>()
  for (let f = 0; f < frames.length; f++) {
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const key = cellKey(row, col)
        const visualCell = cellMap.get(key)
        if (!visualCell?.visible || hiddenSet.has(key)) continue
        const alpha = frames[f][row]?.[col] ?? 0
        if (alpha > 0 || f === 0 || cellFrames.has(key)) {
          if (!cellFrames.has(key)) cellFrames.set(key, [])
          cellFrames.get(key)!.push(alpha)
        }
      }
    }
  }

  const backgroundCells: BackgroundCell[] = []
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const key = cellKey(row, col)
      const visualCell = cellMap.get(key)
      if (!visualCell?.visible || hiddenSet.has(key)) continue
      const shape = props.shapes.get(key) ?? defaultShape
      backgroundCells.push({
        key,
        className: `ls-bg-${row}-${col}`,
        inlineStyle: [
          `left: ${visualCell.x}px;`,
          `top: ${visualCell.y}px;`,
          `width: ${cellSize}px;`,
          `height: ${cellSize}px;`,
          'background: #ffffff;',
          shapeToCss(shape, visualCell.orientation),
        ].filter(Boolean).join(' '),
      })
    }
  }

  const cells: ExportCell[] = []
  for (const [key, values] of cellFrames) {
    if (!values.some((value) => value > 0)) continue
    const visualCell = cellMap.get(key)
    if (!visualCell?.visible) continue
    while (values.length < frames.length) values.push(0)

    const [row, col] = key.split(',').map(Number)
    const shape = props.shapes.get(key) ?? defaultShape
    const glow = props.glows.get(key) ?? defaultGlow
    const size = props.sizes.get(key) ?? 1
    const fill = props.colors.get(key) ?? defaultColor
    const className = `ls-cell-${row}-${col}`
    const shapeStyle = shapeToCss(shape, visualCell.orientation)
    const glowStyle = glow > 0 ? `filter: drop-shadow(0 0 ${(glow / 1.6).toFixed(1)}px ${fill});` : ''
    const sizeStyle = size !== 1 ? `transform: scale(${size});` : ''

    cells.push({
      key,
      row,
      col,
      x: visualCell.x,
      y: visualCell.y,
      values,
      className,
      inlineStyle: [
        `left: ${visualCell.x}px;`,
        `top: ${visualCell.y}px;`,
        `width: ${cellSize}px;`,
        `height: ${cellSize}px;`,
        `background: ${fill};`,
        shapeStyle,
        glowStyle,
        sizeStyle,
      ].filter(Boolean).join(' '),
    })
  }

  return { cells, backgroundCells, visualGrid }
}

function shapeToCss(shape: string, orientation?: 'up' | 'down') {
  switch (shape) {
    case 'circle':
      return 'border-radius: 999px;'
    case 'diamond':
      return 'clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);'
    case 'triangle':
      return orientation === 'down'
        ? 'clip-path: polygon(0% 0%, 100% 0%, 50% 100%);'
        : 'clip-path: polygon(50% 0%, 100% 100%, 0% 100%);'
    case 'hexagon':
      return 'clip-path: polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%);'
    default:
      return 'border-radius: 2px;'
  }
}

function keyframesForCell(className: string, values: number[]) {
  const maxIndex = Math.max(1, values.length - 1)
  const stops = values.map((value, index) => {
    const pct = ((index / maxIndex) * 100).toFixed(3).replace(/\.?0+$/, '')
    return `  ${pct}% { opacity: ${Number(value.toFixed(3))}; }`
  })

  return `@keyframes ${className} {\n${stops.join('\n')}\n}`
}

function valuesKey(values: number[]): string {
  return values.map((v) => Number(v.toFixed(3))).join(',')
}

function buildCss(options: LoaderOptions, frames: number[][][], cells: ExportCell[], width: number, height: number) {
  const duration = `${(frames.length / options.speed).toFixed(3).replace(/\.?0+$/, '')}s`
  const baseCss = `.loader-studio-loader {
  position: relative;
  width: ${width}px;
  height: ${height}px;
}

.loader-studio-loader .ls-cell {
  position: absolute;
  transform-origin: center;
}

.loader-studio-loader .ls-bg {
  position: absolute;
  opacity: 0.08;
}

.loader-studio-loader .ls-anim {
  opacity: 0;
  animation-duration: ${duration};
  animation-timing-function: steps(1, end);
  animation-iteration-count: infinite;
}`

  const keyframeGroups = new Map<string, { name: string; values: number[] }>()
  let keyframeIdx = 0
  for (const cell of cells) {
    const k = valuesKey(cell.values)
    if (!keyframeGroups.has(k)) {
      keyframeGroups.set(k, { name: `ls-kf-${keyframeIdx}`, values: cell.values })
      keyframeIdx++
    }
  }

  const keyframeCss = Array.from(keyframeGroups.values())
    .map((group) => keyframesForCell(group.name, group.values))
    .join('\n\n')

  const cellCss = cells.map((cell) => {
    const k = valuesKey(cell.values)
    const name = keyframeGroups.get(k)!.name
    return `.${cell.className} {
  ${cell.inlineStyle}
  animation-name: ${name};
}`
  }).join('\n\n')

  return `${baseCss}\n\n${keyframeCss}\n\n${cellCss}`
}

export function generateLoaderHTML(
  options: LoaderOptions,
  frames: number[][][],
  customPath?: CustomPathStep[],
  hiddenCells?: string[]
) {
  const { cells, backgroundCells, visualGrid } = buildAnimatedCells(options, frames, customPath, hiddenCells)
  const css = buildCss(options, frames, cells, visualGrid.width, visualGrid.height)
  const markup = `<div class="loader-studio-loader" aria-label="Animated loader" role="img">
${backgroundCells.map((cell) => `  <span class="ls-cell ls-bg ${cell.className}" style="${cell.inlineStyle}"></span>`).join('\n')}
${cells.map((cell) => `  <span class="ls-cell ls-anim ${cell.className}"></span>`).join('\n')}
</div>`

  return `<style>
${css}
</style>

${markup}`
}

export function generateLoaderReact(
  options: LoaderOptions,
  frames: number[][][],
  customPath?: CustomPathStep[],
  hiddenCells?: string[]
) {
  const { cells, backgroundCells, visualGrid } = buildAnimatedCells(options, frames, customPath, hiddenCells)
  const css = buildCss(options, frames, cells, visualGrid.width, visualGrid.height)

  return `export default function LoaderStudioAnimation() {
  return (
    <>
      <style>{\`${cssEscape(css)}\`}</style>
      <div className="loader-studio-loader" aria-label="Animated loader" role="img">
${backgroundCells.map((cell) => `        <span className="ls-cell ls-bg ${cell.className}" style={{ ${styleStringToReactObject(cell.inlineStyle)} }} />`).join('\n')}
${cells.map((cell) => `        <span className="ls-cell ls-anim ${cell.className}" />`).join('\n')}
      </div>
    </>
  )
}`
}

function styleStringToReactObject(style: string) {
  return style
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const [property, ...valueParts] = declaration.split(':')
      const value = valueParts.join(':').trim()
      const camelProperty = property.trim().replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
      return `${camelProperty}: '${cssEscape(value)}'`
    })
    .join(', ')
}
