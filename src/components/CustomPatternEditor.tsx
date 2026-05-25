'use client'

import { useCallback, useMemo, useState } from 'react'
import type { CellShape, CustomPathPoint, CustomPathStep, LoaderOptions, MovementPattern } from '@/lib/types'
import { generateCustomFrames } from '@/lib/patterns'

interface Props {
  options: LoaderOptions
  frames: number[][][]
  path: CustomPathStep[]
  hiddenCells: string[]
  onPathChange: (path: CustomPathStep[], frames: number[][][]) => void
  onHiddenCellsChange: (hidden: string[]) => void
  onClearDraft?: () => void
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

const DIRECTIONS: { key: MovementPattern | undefined; label: string }[] = [
  { key: undefined, label: 'Clicked order' },
  { key: 'wave-lr', label: 'Left to right' },
  { key: 'wave-rl', label: 'Right to left' },
  { key: 'wave-tb', label: 'Top to bottom' },
  { key: 'wave-bt', label: 'Bottom to top' },
  { key: 'diagonal', label: 'Diagonal' },
  { key: 'pulse', label: 'Pulse' },
]

const SHAPES: CellShape[] = ['square', 'circle', 'diamond', 'triangle', 'hexagon']

export default function CustomPatternEditor({
  options,
  path,
  hiddenCells,
  onPathChange,
  onHiddenCellsChange,
  onClearDraft,
}: Props) {
  const [activePathIndex, setActivePathIndex] = useState(0)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [styleScope, setStyleScope] = useState<'selected' | 'path' | 'all'>('selected')
  const [hoveredPathIndex, setHoveredPathIndex] = useState<number | null>(null)

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
    let shape: CellShape | undefined

    for (const cell of selectedCells) {
      opacity = cellAlpha(cell)
      if (cell.color) color = cell.color
      if (cell.glow != null) glow = cell.glow
      if (cell.shape) shape = cell.shape
    }

    return { opacity, color, glow, shape }
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

  const handleCellClick = useCallback((row: number, col: number) => {
    const key = k(row, col)
    if (hiddenSet.has(key)) return

    const placement = cellToPlacement.get(key)
    if (placement) {
      setActivePathIndex(placement.pathIndex)
      setSelectedKeys((keys) =>
        keys.includes(key)
          ? keys.filter((k) => k !== key)
          : [...keys, key]
      )
      return
    }

    appendCellToPath(row, col)
  }, [appendCellToPath, cellToPlacement, hiddenSet])

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

  const scopeKeys = useMemo(() => {
    if (styleScope === 'selected') return new Set(selectedKeys)
    if (styleScope === 'path' && activePath) {
      return new Set(getStepCells(activePath).map((cell) => k(cell.row, cell.col)))
    }
    if (styleScope === 'all') {
      return new Set(path.flatMap((step) => getStepCells(step).map((cell) => k(cell.row, cell.col))))
    }
    return new Set<string>()
  }, [activePath, path, selectedKeys, styleScope])

  const updateCellProp = useCallback((val: string | number, prop: 'opacity' | 'color' | 'glow' | 'shape') => {
    if (scopeKeys.size === 0) return

    updatePath(path.map((step) => ({
      ...step,
      cells: getStepCells(step).map((cell) => (
        scopeKeys.has(k(cell.row, cell.col)) ? { ...cell, [prop]: val } : cell
      )),
      tracks: undefined,
    })))
  }, [path, scopeKeys, updatePath])

  const removeCellProp = useCallback((prop: 'color' | 'glow' | 'shape') => {
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

  const handleMotionChange = useCallback((direction: MovementPattern | undefined) => {
    if (!activePath) return
    updatePath(path.map((step, index) => (
      index === safeActivePathIndex
        ? { ...step, pattern: direction }
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
    for (const step of path) {
      const cells = [step.cells, ...(step.tracks?.map((track) => track.cells) ?? [])].flat()
      for (const c of cells) {
        const key = k(c.row, c.col)
        if (c.color) colors.set(key, c.color)
        if (c.shape) shapes.set(key, c.shape)
        const g = c.glow ?? step.glow
        if (g != null && g > 0) glows.set(key, g)
      }
    }
    return { colors, shapes, glows }
  }, [path])

  const editorCellSize = Math.floor(Math.min(440 / options.gridSize - 6, options.cellSize * 3.4))
  const selectedCount = selectedKeys.length
  const activeIsGroup = activePath?.buildAs === 'group'
  const showCreateGroup = selectedCount >= 2

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
      </div>

      <div className="builder-layout">
        <div className="builder-canvas-wrap">

          <div
            className="custom-grid"
            style={{
              gridTemplateColumns: `repeat(${options.gridSize}, ${editorCellSize}px)`,
              gap: options.gap,
            }}
          >
            {Array.from({ length: options.gridSize }, (_, row) =>
              Array.from({ length: options.gridSize }, (_, col) => {
                const key = k(row, col)
                const hidden = hiddenSet.has(key)
                const placement = cellToPlacement.get(key)
                const isSelected = selectedSet.has(key)
                const isActivePath = placement?.pathIndex === safeActivePathIndex
                const isHoveredPath = placement != null && placement.pathIndex === hoveredPathIndex
                const isIdlePath = placement != null && placement.pathIndex !== safeActivePathIndex && !isSelected
                const cellColor = cellProps.colors.get(key) ?? options.color
                const cellGlow = cellProps.glows.get(key) ?? options.glow
                const cellShape = cellProps.shapes.get(key) ?? options.shape
                const customColor = cellProps.colors.has(key)

                return (
                  <button
                    key={key}
                    onClick={() => handleCellClick(row, col)}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      toggleHiddenCell(row, col)
                    }}
                    className={`builder-cell tile-${cellShape} ${hidden ? 'is-hidden' : ''} ${isSelected ? 'is-selected' : ''} ${placement ? 'has-step' : ''} ${isActivePath ? 'is-active-path' : ''} ${isHoveredPath ? 'is-hovered-path' : ''} ${isIdlePath ? 'is-idle-path' : ''} ${placement?.isGroup ? 'is-group' : ''}`}
                    style={{
                      width: editorCellSize,
                      height: editorCellSize,
                      ...(!isSelected && cellGlow > 0 ? { boxShadow: `0 0 ${cellGlow / 2}px ${cellGlow * 2}px ${cellColor}40` } : {}),
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
          <section>
            <div className="inspector-row">
              <p className="inspector-label">Paths</p>
            </div>

            <div className="path-strip">
              {path.map((step, index) => (
                <div
                  key={`${index}-${getStepCells(step).length}`}
                  className={`path-chip ${index === safeActivePathIndex ? 'is-active' : ''}`}
                  onMouseEnter={() => setHoveredPathIndex(index)}
                  onMouseLeave={() => setHoveredPathIndex(null)}
                >
                  <strong onClick={() => {
                    setActivePathIndex(index)
                    setSelectedKeys(getStepCells(step).map((cell) => k(cell.row, cell.col)))
                  }}>{labelForPath(index)}</strong>
                  <span onClick={() => {
                    setActivePathIndex(index)
                    setSelectedKeys(getStepCells(step).map((cell) => k(cell.row, cell.col)))
                  }}>{getStepCells(step).length} cells</span>
                  {step.buildAs === 'group' && (
                    <em onClick={handleUngroup} title="Click to ungroup">
                      Group
                      <span className="ungroup-hint">✕</span>
                    </em>
                  )}
                  <div className="path-chip-controls">
                    <button
                      className="reorder-btn"
                      onClick={() => movePathUp(index)}
                      disabled={index === 0}
                      title="Move earlier"
                    >▲</button>
                    <button
                      className="reorder-btn"
                      onClick={() => movePathDown(index)}
                      disabled={index === path.length - 1}
                      title="Move later"
                    >▼</button>
                    <button
                      className="reorder-btn reverse-btn"
                      onClick={() => reversePath(index)}
                      title="Reverse cell order"
                    >↻</button>
                  </div>
                  {index > 0 && (
                    <button
                      className="timing-toggle"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleStepTiming(index)
                      }}
                      title="Toggle start timing"
                    >
                      {step.timing === 'simultaneous' ? 'Start together' : 'Start after'}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {timingSummary && (
              <p className="timing-summary">{timingSummary}</p>
            )}

            <div className="path-actions">
              <button
                className={`path-action-primary ${activePathIndex >= path.length ? 'is-active' : ''}`}
                onClick={() => {
                  setSelectedKeys([])
                  const cleanPath = path.filter((step) => getStepCells(step).length > 0)
                  setActivePathIndex(cleanPath.length)
                  if (cleanPath.length !== path.length) {
                    updatePath(cleanPath)
                  }
                }}
              >
                {activePathIndex >= path.length && path.length > 0
                  ? `Adding ${labelForPath(path.length)}`
                  : 'New path'}
              </button>
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
              {onClearDraft && (
                <button
                  className="path-action-secondary"
                  onClick={onClearDraft}
                >
                  Clear draft
                </button>
              )}
              </div>
            </section>

          <section>
            <div className="inspector-row">
              <p className="inspector-label">Selection</p>
              {selectedCount > 0 && (
                <button className="text-button" onClick={() => setSelectedKeys([])}>Deselect</button>
              )}
            </div>

            {selectedCount === 0 && !showCreateGroup ? (
              <p className="muted-copy">
                {activePathIndex >= path.length && path.length > 0
                  ? `Path ${labelForPath(path.length)} ready. Click cells to add steps.`
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
                    <strong>{selectedCount} selected</strong>
                    <button onClick={handleRemoveSelected} className="text-button">Remove selected</button>
                  </>
                )}
          {(selectedCount > 0 || path.length > 0) && (
                  <>
                    <strong>{selectedCount} selected</strong>
                    <button onClick={handleRemoveSelected} className="text-button">Remove selected</button>
                  </>
                )}
              </div>
            )}
          </section>

          {activePath && activeIsGroup && (
            <section>
              <div className="inspector-row">
                <p className="inspector-label">Motion</p>
                <button className="text-button" onClick={handleUngroup}>Ungroup</button>
              </div>
              <div className="direction-grid">
                {DIRECTIONS.map((direction) => (
                  <button
                    key={direction.label}
                    onClick={() => handleMotionChange(direction.key)}
                    className={activePath.pattern === direction.key ? 'is-active' : ''}
                  >
                    {direction.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          {selectedCount > 0 && (
            <section>
              <p className="inspector-label">Selected style</p>
              <div className="scope-toggle">
                {(['selected', 'path', 'all'] as const).map((scope) => (
                  <button
                    key={scope}
                    onClick={() => setStyleScope(scope)}
                    className={`scope-button ${styleScope === scope ? 'is-active' : ''}`}
                    disabled={scope === 'path' && !activePath}
                  >
                    {scope === 'selected' ? 'Selected' : scope === 'path' ? 'Path' : 'All animated'}
                  </button>
                ))}
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
                    className={`shape-button ${(selectedProps.shape ?? options.shape) === shape ? 'is-active' : ''}`}
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
