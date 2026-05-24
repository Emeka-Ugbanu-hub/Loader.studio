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
}

type AnimationMode = 'sequence' | 'simultaneous'

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
}: Props) {
  const [activePathIndex, setActivePathIndex] = useState(0)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])

  const hiddenSet = useMemo(() => new Set(hiddenCells), [hiddenCells])
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys])
  const safeActivePathIndex = Math.min(activePathIndex, path.length)
  const activePath = path[safeActivePathIndex]

  const animationMode: AnimationMode = path.slice(1).some((step) => step.timing === 'simultaneous')
    ? 'simultaneous'
    : 'sequence'

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

  const selectedProps = useMemo(() => {
    let opacity = 100
    let color = options.color
    let shape: CellShape | undefined

    for (const cell of selectedCells) {
      opacity = cellAlpha(cell)
      if (cell.color) color = cell.color
      if (cell.shape) shape = cell.shape
    }

    return { opacity, color, shape }
  }, [selectedCells, options.color])

  const updatePath = useCallback((nextPath: CustomPathStep[]) => {
    onPathChange(nextPath, generateCustomFrames(nextPath, options.gridSize))
  }, [onPathChange, options.gridSize])

  const setAnimationMode = useCallback((mode: AnimationMode) => {
    updatePath(path.map((step, index) => ({
      ...step,
      timing: index === 0 ? 'sequence' : mode,
    })))
  }, [path, updatePath])

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
        timing: nextPath.length === 0 ? 'sequence' : animationMode,
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
  }, [animationMode, cellToPlacement, hiddenSet, path, safeActivePathIndex, updatePath])

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

  const updateCellProp = useCallback((val: string | number, prop: 'opacity' | 'color' | 'shape') => {
    if (selectedKeys.length === 0) return

    updatePath(path.map((step) => ({
      ...step,
      cells: getStepCells(step).map((cell) => (
        selectedSet.has(k(cell.row, cell.col)) ? { ...cell, [prop]: val } : cell
      )),
      tracks: undefined,
    })))
  }, [path, selectedKeys, selectedSet, updatePath])

  const removeCellProp = useCallback((prop: 'color' | 'shape') => {
    if (selectedKeys.length === 0) return

    updatePath(path.map((step) => ({
      ...step,
      cells: getStepCells(step).map((cell) => {
        if (!selectedSet.has(k(cell.row, cell.col))) return cell
        const copy = { ...cell }
        delete copy[prop]
        return copy
      }),
      tracks: undefined,
    })))
  }, [path, selectedKeys, selectedSet, updatePath])

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

  const handleCreateGroup = useCallback(() => {
    if (!activePath) return
    updatePath(path.map((step, index) => (
      index === safeActivePathIndex
        ? { ...step, buildAs: 'group', play: 'one-by-one', pattern: 'wave-lr' }
        : step
    )))
    setActivePathIndex(path.length)
  }, [activePath, path, safeActivePathIndex, updatePath])

  const editorCellSize = Math.floor(Math.min(440 / options.gridSize - 6, 48))
  const selectedCount = selectedKeys.length
  const activeIsGroup = activePath?.buildAs === 'group'
  const showCreateGroup = activePath && !activeIsGroup && getStepCells(activePath).length > 1
  const showTiming = path.length > 1

  return (
    <div className="custom-workspace">
      <div className="builder-toolbar">
        <div>
          <p className="eyebrow">Custom builder</p>
          <h3 className="panel-title small">Build ordered paths on the grid</h3>
        </div>
        <div className="builder-actions">
          <button
            onClick={() => {
              setSelectedKeys([])
              setActivePathIndex(path.length)
            }}
          >
            New path
          </button>
          <button onClick={undoLast} disabled={path.length === 0}>Undo</button>
          <button onClick={clearAll} disabled={path.length === 0 && hiddenCells.length === 0}>Clear</button>
        </div>
      </div>

      <div className="builder-layout">
        <div className="builder-canvas-wrap">

          <div
            className="custom-grid"
            style={{
              gridTemplateColumns: `repeat(${options.gridSize}, ${editorCellSize}px)`,
              gap: 6,
            }}
          >
            {Array.from({ length: options.gridSize }, (_, row) =>
              Array.from({ length: options.gridSize }, (_, col) => {
                const key = k(row, col)
                const hidden = hiddenSet.has(key)
                const placement = cellToPlacement.get(key)
                const isSelected = selectedSet.has(key)
                const isActivePath = placement?.pathIndex === safeActivePathIndex

                return (
                  <button
                    key={key}
                    onClick={() => handleCellClick(row, col)}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      toggleHiddenCell(row, col)
                    }}
                    className={`builder-cell ${hidden ? 'is-hidden' : ''} ${isSelected ? 'is-selected' : ''} ${placement ? 'has-step' : ''} ${isActivePath ? 'is-active-path' : ''} ${placement?.isGroup ? 'is-group' : ''}`}
                    style={{ width: editorCellSize, height: editorCellSize }}
                    aria-label={`Cell row ${row + 1}, column ${col + 1}`}
                  >
                    {hidden ? (
                      <span className="cell-mask" />
                    ) : placement ? (
                      <span className="cell-index">{placement.cellIndex + 1}</span>
                    ) : null}
                  </button>
                )
              })
            )}
          </div>

          <div className="builder-stats">
            <span>{path.length} paths</span>
            <span>{hiddenCells.length} masked</span>
            <span>{selectedCount} selected</span>
          </div>
        </div>

        <div className="inspector-panel">
          <section>
            <div className="inspector-row">
              <p className="inspector-label">Paths</p>
              {showTiming && (
                <div className="mini-toggle" aria-label="Animation mode">
                  <button
                    onClick={() => setAnimationMode('sequence')}
                    className={animationMode === 'sequence' ? 'is-active' : ''}
                  >
                    Sequence
                  </button>
                  <button
                    onClick={() => setAnimationMode('simultaneous')}
                    className={animationMode === 'simultaneous' ? 'is-active' : ''}
                  >
                    Simultaneous
                  </button>
                </div>
              )}
            </div>

            <div className="path-strip">
              {path.map((step, index) => (
                <button
                  key={`${index}-${getStepCells(step).length}`}
                  onClick={() => {
                    setActivePathIndex(index)
                    setSelectedKeys(getStepCells(step).map((cell) => k(cell.row, cell.col)))
                  }}
                  className={`path-chip ${index === safeActivePathIndex ? 'is-active' : ''}`}
                >
                  <strong>{labelForPath(index)}</strong>
                  <span>{getStepCells(step).length} cells</span>
                  {step.buildAs === 'group' && <em>Group</em>}
                </button>
              ))}
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
              <p className="muted-copy">Click cells to add them. Click a path label to select cells for styling.</p>
            ) : (
              <div className="selection-tools">
                {showCreateGroup && (
                  <button onClick={handleCreateGroup} className="secondary-action">Create group</button>
                )}
                {selectedCount > 0 && (
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
              <p className="inspector-label">Cell style</p>
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
