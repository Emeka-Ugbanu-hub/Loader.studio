'use client'

import { useCallback, useMemo, useState } from 'react'
import type { CellShape, CustomPathPoint, CustomPathStep, LoaderOptions, MovementPattern } from '@/lib/types'
import { generateCustomFrames } from '@/lib/patterns'
import { getCellMap, getVisualGrid, layoutCellShape } from '@/lib/gridLayout'
import { getDisplayCellSize } from '@/lib/displaySizing'
import InfoTip from './InfoTip'

interface Props {
  options: LoaderOptions
  frames: number[][][]
  path: CustomPathStep[]
  hiddenCells: string[]
  onPathChange: (path: CustomPathStep[], frames: number[][][]) => void
  onHiddenCellsChange: (hidden: string[]) => void
}

function k(r: number, c: number) {
  return `${r},${c}`
}

function labelForPath(index: number) {
  return String.fromCharCode(65 + index)
}

function getStepCells(step: CustomPathStep) {
  return [step.cells, ...(step.tracks?.map((track) => track.cells) ?? [])].flat()
}

function cellAlpha(cell: CustomPathPoint) {
  return cell.opacity ?? 100
}

type MotionMode = 'clicked' | 'together' | MovementPattern

const MOTION_OPTIONS: { value: MotionMode; label: string }[] = [
  { value: 'clicked', label: 'Clicked order' },
  { value: 'together', label: 'Together' },
  { value: 'wave-lr', label: 'Left to right' },
  { value: 'wave-rl', label: 'Right to left' },
  { value: 'wave-tb', label: 'Top to bottom' },
  { value: 'wave-bt', label: 'Bottom to top' },
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'pulse', label: 'Pulse' },
]

const SHAPES: CellShape[] = ['square', 'circle', 'diamond', 'triangle', 'hexagon']
const MIN_EDITOR_CELL_SIZE = 28

function getMotionMode(step?: CustomPathStep): MotionMode {
  if (step?.play === 'together') return 'together'
  if (step?.buildAs !== 'group') return 'clicked'
  return step?.pattern ?? 'clicked'
}

export default function CustomPatternEditor({
  options,
  path,
  hiddenCells,
  onPathChange,
  onHiddenCellsChange,
}: Props) {
  const [activePathIndex, setActivePathIndex] = useState(0)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [hoveredPathIndex, setHoveredPathIndex] = useState<number | null>(null)
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [reversedIndex, setReversedIndex] = useState<number | null>(null)

  const hiddenSet = useMemo(() => new Set(hiddenCells), [hiddenCells])
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys])
  const safeActivePathIndex = Math.min(activePathIndex, path.length)
  const activePath = path[safeActivePathIndex]

  const cellToPlacement = useMemo(() => {
    const placements = new Map<string, { pathIndex: number; cellIndex: number; isGroup: boolean }>()
    path.forEach((step, pathIndex) => {
      getStepCells(step).forEach((cell, cellIndex) => {
        placements.set(k(cell.row, cell.col), {
          pathIndex,
          cellIndex,
          isGroup: step.buildAs === 'group',
        })
      })
    })
    return placements
  }, [path])

  const selectedCells = useMemo(() => (
    selectedKeys.map((key) => {
      const [row, col] = key.split(',').map(Number)
      const placement = cellToPlacement.get(key)
      if (placement) {
        const existing = getStepCells(path[placement.pathIndex])[placement.cellIndex]
        if (existing) return { ...existing }
      }
      return { row, col }
    })
  ), [selectedKeys, cellToPlacement, path])

  const selectionBasket = useMemo(() => {
    return selectedKeys.map((key) => {
      const placement = cellToPlacement.get(key)
      return placement
        ? `${labelForPath(placement.pathIndex)}${placement.cellIndex + 1}`
        : null
    }).filter(Boolean) as string[]
  }, [selectedKeys, cellToPlacement])

  const selectedProps = useMemo(() => {
    let opacity = 100
    let color = options.color
    let glow = options.glow
    let trail = false
    let size = 1
    let shape: CellShape | undefined

    for (const cell of selectedCells) {
      opacity = cellAlpha(cell)
      if (cell.color) color = cell.color
      if (cell.glow != null) glow = cell.glow
      if (cell.trail != null) trail = cell.trail
      if (cell.size != null) size = cell.size
      if (cell.shape) shape = cell.shape
    }

    return { opacity, color, glow, trail, size, shape }
  }, [selectedCells, options.color, options.glow])

  const updatePath = useCallback((nextPath: CustomPathStep[]) => {
    onPathChange(nextPath, generateCustomFrames(nextPath, options.gridSize))
  }, [onPathChange, options.gridSize])

  const toggleHiddenCell = useCallback((r: number, c: number) => {
    const key = k(r, c)
    onHiddenCellsChange(hiddenSet.has(key)
      ? hiddenCells.filter((hidden) => hidden !== key)
      : [...hiddenCells, key]
    )
    setSelectedKeys((keys) => keys.filter((selected) => selected !== key))
  }, [hiddenCells, hiddenSet, onHiddenCellsChange])

  const appendCellToPath = useCallback((row: number, col: number) => {
    const key = k(row, col)
    if (hiddenSet.has(key) || cellToPlacement.has(key)) return

    const nextCell: CustomPathPoint = { row, col }
    const nextPath = path.map((step) => ({ ...step, cells: getStepCells(step).map((c) => ({ ...c })) }))
    const index = safeActivePathIndex

    if (index >= nextPath.length) {
      nextPath.push({
        cells: [nextCell],
        buildAs: 'singles',
        play: 'one-by-one',
        timing: 'sequence',
      })
      setActivePathIndex(nextPath.length - 1)
    } else {
      nextPath[index] = {
        ...nextPath[index],
        cells: [...getStepCells(nextPath[index]), nextCell],
        tracks: undefined,
        buildAs: nextPath[index].buildAs ?? 'singles',
        play: nextPath[index].play ?? 'one-by-one',
      }
    }

    updatePath(nextPath)
  }, [cellToPlacement, hiddenSet, path, safeActivePathIndex, updatePath])

  const handleCellClick = useCallback((row: number, col: number, shiftKey: boolean) => {
    const key = k(row, col)
    if (hiddenSet.has(key)) return

    const placement = cellToPlacement.get(key)
    if (placement) {
      setActivePathIndex(placement.pathIndex)
      if (shiftKey || multiSelectMode) {
        setSelectedKeys((keys) =>
          keys.includes(key)
            ? keys.filter((k) => k !== key)
            : [...keys, key]
        )
      } else {
        setSelectedKeys([key])
      }
      return
    }

    appendCellToPath(row, col)
  }, [appendCellToPath, cellToPlacement, hiddenSet, multiSelectMode])

  const withoutSelectedCells = useCallback(() => (
    path.flatMap((step) => {
      const cells = getStepCells(step).filter((cell) => !selectedSet.has(k(cell.row, cell.col)))
      if (cells.length === 0) return []
      return [{
        ...step,
        cells,
        tracks: undefined,
      }]
    })
  ), [path, selectedSet])

  const handleRemoveSelected = useCallback(() => {
    if (selectedKeys.length === 0) return
    const nextPath = withoutSelectedCells()
    updatePath(nextPath)
    setSelectedKeys([])
    setActivePathIndex((index) => Math.min(index, nextPath.length))
  }, [selectedKeys, updatePath, withoutSelectedCells])

  const scopeKeys = useMemo(() => new Set(selectedKeys), [selectedKeys])

  const updateCellProp = useCallback((val: string | number | boolean, prop: 'opacity' | 'color' | 'glow' | 'trail' | 'size' | 'shape') => {
    if (scopeKeys.size === 0) return

    updatePath(path.map((step) => ({
      ...step,
      cells: getStepCells(step).map((cell) => (
        scopeKeys.has(k(cell.row, cell.col)) ? { ...cell, [prop]: val } : cell
      )),
      tracks: undefined,
    })))
  }, [path, scopeKeys, updatePath])

  const removeCellProp = useCallback((prop: 'color' | 'glow' | 'trail' | 'size' | 'shape') => {
    if (scopeKeys.size === 0) return

    updatePath(path.map((step) => ({
      ...step,
      cells: getStepCells(step).map((cell) => {
        if (!scopeKeys.has(k(cell.row, cell.col))) return cell
        const copy = { ...cell }
        delete copy[prop]
        return copy
      }),
      tracks: undefined,
    })))
  }, [path, scopeKeys, updatePath])

  const handleMotionChange = useCallback((motion: MotionMode) => {
    if (!activePath) return

    updatePath(path.map((step, index) => (
      index === safeActivePathIndex
        ? {
          ...step,
          play: motion === 'together' ? 'together' : 'one-by-one',
          pattern: motion === 'clicked' || motion === 'together' ? undefined : motion,
        }
        : step
    )))
  }, [activePath, path, safeActivePathIndex, updatePath])

  const handleUngroup = useCallback(() => {
    if (!activePath) return
    updatePath(path.map((step, index) => (
      index === safeActivePathIndex
        ? { ...step, buildAs: 'singles', pattern: undefined }
        : step
    )))
  }, [activePath, path, safeActivePathIndex, updatePath])

  const undoLast = useCallback(() => {
    const nextPath = path.map((step) => ({ ...step, cells: getStepCells(step), tracks: undefined }))
    const index = Math.min(safeActivePathIndex, nextPath.length - 1)

    if (index < 0) return
    const step = nextPath[index]
    const nextCells = step.cells.slice(0, -1)

    if (nextCells.length === 0) nextPath.splice(index, 1)
    else nextPath[index] = { ...step, cells: nextCells }

    updatePath(nextPath)
    setSelectedKeys([])
    setActivePathIndex(Math.min(index, nextPath.length))
  }, [path, safeActivePathIndex, updatePath])

  const clearAll = useCallback(() => {
    updatePath([])
    setSelectedKeys([])
    setActivePathIndex(0)
    onHiddenCellsChange([])
  }, [onHiddenCellsChange, updatePath])

  const cellProps = useMemo(() => {
    const colors = new Map<string, string>()
    const shapes = new Map<string, CellShape>()
    const glows = new Map<string, number>()
    const sizes = new Map<string, number>()
    for (const step of path) {
      const cells = [step.cells, ...(step.tracks?.map((track) => track.cells) ?? [])].flat()
      for (const c of cells) {
        const key = k(c.row, c.col)
        if (c.color) colors.set(key, c.color)
        if (c.shape) shapes.set(key, c.shape)
        const g = c.glow ?? step.glow
        if (g != null && g > 0) glows.set(key, g)
        const s = c.size ?? step.size
        if (s != null && s !== 1) sizes.set(key, s)
      }
    }
    return { colors, shapes, glows, sizes }
  }, [path])

  const editorCellSize = Math.max(
    MIN_EDITOR_CELL_SIZE,
    getDisplayCellSize(options.gridSize, options.cellSize, 440)
  )
  const visualGrid = useMemo(
    () => getVisualGrid(options.layout ?? 'matrix', options.gridSize, editorCellSize, options.gap),
    [editorCellSize, options.gap, options.gridSize, options.layout]
  )
  const visualCellMap = useMemo(() => getCellMap(visualGrid), [visualGrid])
  const usesFreeformLayout = (options.layout ?? 'matrix') !== 'matrix'
  const fitScale = Math.min(1, 420 / Math.max(visualGrid.width, visualGrid.height))
  const gridScale = Math.max(0.7, fitScale)
  const selectedCount = selectedKeys.length
  const activeIsGroup = activePath?.buildAs === 'group'
  const activeCellCount = activePath ? getStepCells(activePath).length : 0
  const showCreateGroup = selectedCount >= 2
  const activeMotionOptions = activeIsGroup
    ? MOTION_OPTIONS
    : MOTION_OPTIONS.filter((option) => option.value === 'clicked' || option.value === 'together')

  const handleCreateGroup = useCallback(() => {
    if (selectedCount < 2) return

    const keySet = new Set(selectedKeys)
    const selectedIndexes = new Set(
      selectedKeys
        .map((key) => cellToPlacement.get(key)?.pathIndex)
        .filter((idx): idx is number => idx !== undefined)
    )

    if (selectedIndexes.size === 1) {
      const [index] = Array.from(selectedIndexes)
      const allCells = getStepCells(path[index])
      const selectedCoversPath = allCells.length === selectedCells.length
        && allCells.every((cell) => keySet.has(k(cell.row, cell.col)))

      if (selectedCoversPath) {
        updatePath(path.map((step, stepIndex) => (
          stepIndex === index
            ? { ...step, cells: selectedCells, tracks: undefined, buildAs: 'group', play: 'one-by-one', pattern: 'wave-lr' }
            : step
        )))
        setActivePathIndex(index)
        setSelectedKeys([])
        return
      }
    }

    const basePath = path.flatMap((step) => {
      const remaining = getStepCells(step).filter((cell) => !keySet.has(k(cell.row, cell.col)))
      if (remaining.length === 0) return []
      return [{ ...step, cells: remaining, tracks: undefined }]
    })

    const step: CustomPathStep = {
      cells: selectedCells,
      buildAs: 'group',
      play: 'one-by-one',
      pattern: 'wave-lr',
      timing: basePath.length === 0 ? 'sequence' : 'sequence',
    }

    updatePath([...basePath, step])
    setActivePathIndex(basePath.length)
    setSelectedKeys([])
  }, [cellToPlacement, path, selectedCells, selectedCount, selectedKeys, updatePath])

  const toggleStepTiming = useCallback((index: number) => {
    updatePath(path.map((step, stepIndex) => (
      stepIndex === index
        ? { ...step, timing: step.timing === 'simultaneous' ? 'sequence' : 'simultaneous' }
        : step
    )))
  }, [path, updatePath])

  const reversePath = useCallback((index: number) => {
    updatePath(path.map((step, stepIndex) => (
      stepIndex === index
        ? { ...step, cells: [...getStepCells(step)].reverse() }
        : step
    )))
  }, [path, updatePath])

  const handleReverse = useCallback((index: number) => {
    reversePath(index)
    setReversedIndex((prev) => prev === index ? null : index)
  }, [reversePath])

  const movePathUp = useCallback((index: number) => {
    if (index <= 0) return
    const nextPath = [...path]
    const [step] = nextPath.splice(index, 1)
    nextPath.splice(index - 1, 0, step)
    updatePath(nextPath)
    setActivePathIndex(index - 1)
  }, [path, updatePath])

  const movePathDown = useCallback((index: number) => {
    if (index >= path.length - 1) return
    const nextPath = [...path]
    const [step] = nextPath.splice(index, 1)
    nextPath.splice(index + 1, 0, step)
    updatePath(nextPath)
    setActivePathIndex(index + 1)
  }, [path, updatePath])

  const timingSummary = useMemo(() => {
    if (path.length === 0) return ''
    const blocks: string[][] = [[labelForPath(0)]]
    for (let i = 1; i < path.length; i++) {
      if (path[i].timing === 'simultaneous') {
        blocks[blocks.length - 1].push(labelForPath(i))
      } else {
        blocks.push([labelForPath(i)])
      }
    }
    return blocks.map((b) => b.join(' + ')).join(' \u2192 ')
  }, [path])

  return (
    <div className="custom-workspace">
      <div className="builder-toolbar">
        <div>
          <p className="eyebrow">Custom builder</p>
          <h3 className="panel-title small">Build ordered paths on the grid</h3>
        </div>
        <InfoTip title="Custom builder">
          <p>Click empty cells to draw an animation path. Numbered cells show the order they animate in.</p>
          <p>Shortcuts: click a numbered cell to edit it, Shift-click numbered cells to multi-select, right-click a cell to mask it.</p>
        </InfoTip>
      </div>

      <div className="builder-layout">
        <div className="builder-canvas-wrap">
          <div
            className="custom-grid-stage"
            style={{
              width: visualGrid.width * gridScale,
              height: visualGrid.height * gridScale,
            }}
          >
            <div
              className={`custom-grid layout-${options.layout ?? 'matrix'}-grid ${usesFreeformLayout ? 'is-freeform' : ''} ${options.gap === 0 ? 'is-gapless' : ''}`}
              style={{
                width: visualGrid.width,
                height: visualGrid.height,
                transform: `scale(${gridScale})`,
              }}
            >
              {Array.from({ length: options.gridSize }, (_, row) =>
                Array.from({ length: options.gridSize }, (_, col) => {
                  const key = k(row, col)
                  const visualCell = visualCellMap.get(key)
                  if (!visualCell?.visible) return null
                  const hidden = hiddenSet.has(key)
                  const placement = cellToPlacement.get(key)
                  const isSelected = selectedSet.has(key)
                  const isActivePath = placement?.pathIndex === safeActivePathIndex
                  const isHoveredPath = placement != null && placement.pathIndex === hoveredPathIndex
                  const isIdlePath = placement != null && placement.pathIndex !== safeActivePathIndex && !isSelected
                  const cellColor = cellProps.colors.get(key) ?? options.color
                  const cellGlow = cellProps.glows.get(key) ?? options.glow
                  const cellShape = cellProps.shapes.get(key) ?? layoutCellShape(options.layout ?? 'matrix', options.shape)
                  const cellSize = cellProps.sizes.get(key) ?? 1
                  const customColor = cellProps.colors.has(key)
                  const editorGlow = Math.min(cellGlow, 6)

                  return (
                    <button
                      key={key}
                      onClick={(e) => handleCellClick(row, col, e.shiftKey)}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        toggleHiddenCell(row, col)
                      }}
                      className={`builder-cell tile-${cellShape} ${cellShape === 'triangle' && visualCell.orientation === 'down' ? 'tile-triangle-down' : ''} ${hidden ? 'is-hidden' : ''} ${isSelected ? 'is-selected' : ''} ${placement ? 'has-step' : ''} ${isActivePath ? 'is-active-path' : ''} ${isHoveredPath ? 'is-hovered-path' : ''} ${isIdlePath ? 'is-idle-path' : ''} ${placement?.isGroup ? 'is-group' : ''}`}
                      style={{
                        width: editorCellSize,
                        height: editorCellSize,
                        position: 'absolute',
                        left: visualCell.x,
                        top: visualCell.y,
                        transform: cellSize !== 1 ? `scale(${cellSize})` : undefined,
                        ...(!isSelected && editorGlow > 0 ? { boxShadow: `0 0 ${editorGlow / 2}px ${editorGlow}px ${cellColor}18` } : {}),
                      }}
                      aria-label={`Cell row ${row + 1}, column ${col + 1}`}
                    >
                      {hidden ? (
                        <span className="cell-mask" />
                      ) : placement ? (
                        <span className="cell-index" style={customColor ? { background: cellColor, color: '#030303' } : undefined}>{placement.cellIndex + 1}</span>
                      ) : null}
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <p className="grid-hint">Click empty cells to build. Click numbered cells to edit.</p>

          <div className="builder-stats">
            <span>{path.length} paths</span>
            <span>{hiddenCells.length} masked</span>
            <span>{selectedCount} selected</span>
            {selectedCount > 0 && (
              <button className="text-button" onClick={() => setSelectedKeys([])}>Deselect</button>
            )}
          </div>
        </div>

        <div className="inspector-panel">
          <section className="paths-section">
            <div className="inspector-row paths-section-header">
              <p className="inspector-label">Paths</p>
              <InfoTip title="Paths">
                <p>Each path is an animation layer. End path finishes the current path; the next empty cell starts a new one.</p>
                <p>Earlier/Later changes path order. Reverse flips the cell order. Starts with previous makes that path animate at the same time as the one before it.</p>
              </InfoTip>
            </div>

            {activePath && (
              <div className="inspector-row" style={{ paddingBottom: 6 }}>
                <span className="control-label">Accumulate</span>
                <button
                  type="button"
                  onClick={() => {
                    updatePath(path.map((step, i) => (
                      i === safeActivePathIndex
                        ? { ...step, accumulate: step.accumulate === false ? true : false }
                        : step
                    )))
                  }}
                  className={`toggle-switch ${activePath.accumulate !== false ? 'is-active' : ''}`}
                >
                  <span />
                </button>
              </div>
            )}

            <div className="paths-scroll">
              <div className="path-strip">
                {path.map((step, index) => (
                  <div
                    key={`${index}-${getStepCells(step).length}`}
                    className={`path-chip ${index === safeActivePathIndex ? 'is-active' : ''}`}
                    onMouseEnter={() => setHoveredPathIndex(index)}
                    onMouseLeave={() => setHoveredPathIndex(null)}
                  >
                    <div
                      className="path-chip-main"
                      onClick={() => {
                        setActivePathIndex(index)
                        setSelectedKeys(getStepCells(step).map((cell) => k(cell.row, cell.col)))
                      }}
                    >
                      <strong>{labelForPath(index)}</strong>
                      <span>{getStepCells(step).length} cells</span>
                      {step.buildAs === 'group' && (
                        <em onClick={(e) => { e.stopPropagation(); handleUngroup() }} title="Click to ungroup">
                          Group ✕
                        </em>
                      )}
                    </div>
                    <div className="path-chip-actions">
                      <button
                        onClick={() => movePathUp(index)}
                        disabled={index === 0}
                      >Earlier</button>
                      <button
                        onClick={() => movePathDown(index)}
                        disabled={index === path.length - 1}
                      >Later</button>
                      <button
                        className={`reverse-action ${reversedIndex === index ? 'is-active' : ''}`}
                        onClick={() => handleReverse(index)}
                      >Reverse</button>
                    </div>
                    {index > 0 && (
                      <button
                        className="timing-row"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleStepTiming(index)
                        }}
                      >
                        {step.timing === 'simultaneous' ? 'Starts with previous' : 'Starts after previous'}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {timingSummary && (
                <p className="timing-summary">{timingSummary}</p>
              )}
            </div>

            <div className="path-actions">
              {activePath && getStepCells(activePath).length > 0 && (
                <button
                  className="path-action-primary"
                  onClick={() => {
                    setSelectedKeys([])
                    setActivePathIndex(path.length)
                  }}
                >
                  End path
                </button>
              )}
              <button
                className="path-action-secondary"
                onClick={undoLast}
                disabled={path.length === 0}
              >
                Undo
              </button>
              <button
                className="path-action-secondary"
                onClick={clearAll}
                disabled={path.length === 0 && hiddenCells.length === 0}
              >
                Clear all
              </button>
              </div>
            </section>

          <section>
            <div className="inspector-row">
              <p className="inspector-label">Selection</p>
              <InfoTip title="Selection">
                <p>Selection is for editing cells that already exist in a path.</p>
                <p>Click selects one cell. Shift-click adds more on desktop. Use Select multiple on touch devices. Create group turns selected cells into one grouped motion layer.</p>
              </InfoTip>
              {selectedCount > 0 && (
                <button className="text-button" onClick={() => setSelectedKeys([])}>Deselect</button>
              )}
            </div>

            {selectedCount === 0 && !showCreateGroup ? (
              <p className="muted-copy">
                {activePathIndex >= path.length && path.length > 0
                  ? `Ready for ${labelForPath(path.length)}. Click a cell to start.`
                  : activePath && getStepCells(activePath).length > 0
                    ? `${labelForPath(safeActivePathIndex)} is open. End path when done.`
                    : path.length === 0
                      ? 'Click empty cells to build Path A.'
                      : 'Click empty cells to build. Click numbered cells to edit.'}
              </p>
            ) : (
              <div className="selection-tools">
                {selectionBasket.length > 0 && (
                  <div className="selection-basket">
                    {selectionBasket.map((label) => (
                      <span key={label} className="selection-chip">{label}</span>
                    ))}
                  </div>
                )}
                {showCreateGroup && (
                  <button onClick={handleCreateGroup} className="secondary-action">Create group</button>
                )}
                {selectedCount > 0 && (
                  <>
                    <div className="selection-meta">
                      <strong>{selectedCount} selected</strong>
                      <label className="multi-toggle">
                        <input
                          type="checkbox"
                          checked={multiSelectMode}
                          onChange={(e) => setMultiSelectMode(e.target.checked)}
                        />
                        <span>Select multiple</span>
                      </label>
                    </div>
                    <button onClick={handleRemoveSelected} className="text-button">Remove selected</button>
                  </>
                )}
              </div>
            )}
          </section>

          {activePath && activeCellCount > 1 && (
            <section>
              <div className="inspector-row">
                <p className="inspector-label">Motion</p>
                <InfoTip title="Motion">
                  <p>Motion controls how the active path reveals itself.</p>
                  <p>Clicked order follows your cell order. Together reveals every cell in this path at once. Groups can also use wave and pulse motion.</p>
                </InfoTip>
                {activeIsGroup && (
                  <button className="text-button" onClick={handleUngroup}>Ungroup</button>
                )}
              </div>
              <label className="select-control">
                <span>Reveal</span>
                <select
                  value={getMotionMode(activePath)}
                  onChange={(event) => handleMotionChange(event.target.value as MotionMode)}
                >
                  {activeMotionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          )}

          {selectedCount > 0 && (
            <section>
              <div className="inspector-row">
                <p className="inspector-label">Selected style</p>
                <InfoTip title="Selected style">
                  <p>These controls change the currently selected cells.</p>
                  <p>To style a whole path, click that path card first. It selects every cell in the path automatically.</p>
                  <p>Trail adds a fade to motion. Opacity controls brightness. Glow affects the final animation while the editor keeps glow subtle so it stays usable.</p>
                </InfoTip>
              </div>
              <div className="inline-control" style={{ marginTop: 4 }}>
                <span>Trail</span>
                <button
                  type="button"
                  onClick={() => updateCellProp(!selectedProps.trail, 'trail')}
                  className={`toggle-switch ${selectedProps.trail ? 'is-active' : ''}`}
                  aria-pressed={selectedProps.trail}
                >
                  <span />
                </button>
              </div>
              <label className="mini-slider">
                <span>Opacity</span>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={selectedProps.opacity}
                  onChange={(e) => updateCellProp(Number(e.target.value), 'opacity')}
                />
                <strong>{selectedProps.opacity}%</strong>
              </label>
              <label className="mini-slider">
                <span>Glow</span>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={2}
                  value={selectedProps.glow}
                  onChange={(e) => updateCellProp(Number(e.target.value), 'glow')}
                />
                <strong>{selectedProps.glow}</strong>
                {selectedProps.glow > 0 && (
                  <button className="text-button" onClick={() => removeCellProp('glow')}>Reset</button>
                )}
              </label>
              <label className="mini-slider">
                <span>Size</span>
                <input
                  type="range"
                  min={50}
                  max={200}
                  step={10}
                  value={(selectedProps.size ?? 1) * 100}
                  onChange={(e) => updateCellProp(Number(e.target.value) / 100, 'size')}
                />
                <strong>{Math.round((selectedProps.size ?? 1) * 100)}%</strong>
                {(selectedProps.size ?? 1) !== 1 && (
                  <button className="text-button" onClick={() => removeCellProp('size')}>Reset</button>
                )}
              </label>
              <div className="inline-control">
                <span>Color</span>
                <input
                  type="color"
                  value={selectedProps.color}
                  onChange={(e) => updateCellProp(e.target.value, 'color')}
                  aria-label="Selected cell color"
                />
                {selectedProps.color !== options.color && (
                  <button onClick={() => removeCellProp('color')}>Reset</button>
                )}
              </div>
              <div className="shape-grid compact">
                {SHAPES.map((shape) => (
                  <button
                    key={shape}
                    onClick={() => updateCellProp(shape, 'shape')}
                    className={`shape-button ${(selectedProps.shape ?? layoutCellShape(options.layout ?? 'matrix', options.shape)) === shape ? 'is-active' : ''}`}
                    title={shape}
                    aria-label={`Use ${shape} for selected cells`}
                  >
                    <span className={`shape-icon shape-${shape}`} />
                  </button>
                ))}
                {selectedProps.shape != null && (
                  <button className="reset-shape" onClick={() => removeCellProp('shape')}>Reset</button>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
