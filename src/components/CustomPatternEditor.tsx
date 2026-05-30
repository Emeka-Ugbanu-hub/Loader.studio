'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CellShape, CustomAnimationUnit, CustomPathPoint, CustomPathStep, LoaderOptions, MovementPattern } from '@/lib/types'
import { generateCustomFrames } from '@/lib/patterns'
import { getCellMap, getVisualGrid, layoutCellShape } from '@/lib/gridLayout'
import { getDisplayCellSize } from '@/lib/displaySizing'
import { getStepCells, getStepUnits } from '@/lib/utils'
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

function cellAlpha(cell: CustomPathPoint) {
  return cell.opacity ?? 100
}

type MotionMode = 'clicked' | 'together' | MovementPattern
type MotionType = 'one' | 'group' | 'fill'

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

function newUnitId() {
  return `unit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function flattenUnits(units: ReturnType<typeof getStepUnits>) {
  return units.flatMap((unit) => unit.cells)
}

function unitsWithoutKeys(step: CustomPathStep, keySet: Set<string>) {
  return getStepUnits(step)
    .map((unit) => ({
      ...unit,
      cells: unit.cells.filter((cell) => !keySet.has(k(cell.row, cell.col))),
    }))
    .filter((unit) => unit.cells.length > 0)
}

function stepWithUnits(step: CustomPathStep, units: ReturnType<typeof getStepUnits>): CustomPathStep {
  return {
    ...step,
    cells: flattenUnits(units),
    units,
    tracks: undefined,
  }
}

function unitOrientation(cells: CustomPathPoint[]): 'row' | 'column' | 'block' | 'single' {
  if (cells.length <= 1) return 'single'
  const rowValues = cells.map((cell) => cell.row)
  const colValues = cells.map((cell) => cell.col)
  const rows = new Set(rowValues)
  const cols = new Set(colValues)
  if (cols.size === 1 && rows.size > 1) return 'column'
  if (rows.size === 1 && cols.size > 1) return 'row'
  const height = Math.max(...rowValues) - Math.min(...rowValues) + 1
  const width = Math.max(...colValues) - Math.min(...colValues) + 1
  if (height > width) return 'column'
  if (width > height) return 'row'
  return 'block'
}

function inferredPatternForCells(cells: CustomPathPoint[]): MovementPattern {
  const orientation = unitOrientation(cells)
  if (orientation === 'column') return 'wave-lr'
  if (orientation === 'row') return 'wave-tb'
  return 'pulse'
}

function selectedKeysCoverGroupedUnit(step: CustomPathStep, keys: Set<string>) {
  return getStepUnits(step).some((unit) => (
    unit.cells.length > 1 && unit.cells.every((cell) => keys.has(k(cell.row, cell.col)))
  ))
}

function getMotionMode(step?: CustomPathStep): MotionMode {
  if (step?.play === 'together') return 'together'
  if (step?.buildAs !== 'group') return 'clicked'
  return step?.pattern ?? 'clicked'
}

function getMotionType(step?: CustomPathStep): MotionType {
  if ((step?.motionMode ?? (step?.accumulate === false ? 'window' : 'fill')) === 'fill') return 'fill'
  return (step?.activeCount ?? 1) > 1 ? 'group' : 'one'
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
  const [moreStyleOpen, setMoreStyleOpen] = useState(false)

  const hiddenSet = useMemo(() => new Set(hiddenCells), [hiddenCells])
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys])
  const safeActivePathIndex = Math.min(activePathIndex, path.length)
  const activePath = path[safeActivePathIndex]

  const cellToPlacement = useMemo(() => {
    const placements = new Map<string, { pathIndex: number; cellIndex: number; unitIndex: number; unitCellIndex: number; isGroup: boolean }>()
    path.forEach((step, pathIndex) => {
      let cellIndex = 0
      getStepUnits(step).forEach((unit, unitIndex) => {
        unit.cells.forEach((cell, unitCellIndex) => {
          placements.set(k(cell.row, cell.col), {
            pathIndex,
            cellIndex,
            unitIndex,
            unitCellIndex,
            isGroup: unit.cells.length > 1,
          })
          cellIndex++
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
    let trailColor: string | undefined
    let glow = options.glow
    let trail = false
    let size = 1
    let shape: CellShape | undefined

    for (const cell of selectedCells) {
      opacity = cellAlpha(cell)
      if (cell.color) color = cell.color
      if (cell.trailColor) trailColor = cell.trailColor
      if (cell.glow != null) glow = cell.glow
      if (cell.trail != null) trail = cell.trail
      if (cell.size != null) size = cell.size
      if (cell.shape) shape = cell.shape
    }

    return { opacity, color, trailColor: trailColor ?? color, glow, trail, size, shape }
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
    const nextPath = path.map((step) => stepWithUnits(step, getStepUnits(step).map((unit) => ({
      ...unit,
      cells: unit.cells.map((c) => ({ ...c })),
    }))))
    const index = safeActivePathIndex

    if (index >= nextPath.length) {
      nextPath.push({
        cells: [nextCell],
        units: [{ id: newUnitId(), cells: [nextCell] }],
        buildAs: 'singles',
        play: 'one-by-one',
        timing: 'sequence',
      })
      setActivePathIndex(nextPath.length - 1)
    } else {
      nextPath[index] = {
        ...nextPath[index],
        cells: [...getStepCells(nextPath[index]), nextCell],
        units: [...getStepUnits(nextPath[index]), { id: newUnitId(), cells: [nextCell] }],
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
      const unitKeys = getStepUnits(path[placement.pathIndex])[placement.unitIndex]?.cells.map((cell) => k(cell.row, cell.col)) ?? [key]
      const keysToToggle = placement.isGroup ? unitKeys : [key]
      if (shiftKey || multiSelectMode) {
        setSelectedKeys((keys) => {
          const hasEveryKey = keysToToggle.every((candidate) => keys.includes(candidate))
          return hasEveryKey
            ? keys.filter((candidate) => !keysToToggle.includes(candidate))
            : Array.from(new Set([...keys, ...keysToToggle]))
        })
      } else {
        setSelectedKeys(keysToToggle)
      }
      return
    }

    appendCellToPath(row, col)
  }, [appendCellToPath, cellToPlacement, hiddenSet, multiSelectMode, path])

  const withoutSelectedCells = useCallback(() => (
    path.flatMap((step) => {
      const units = unitsWithoutKeys(step, selectedSet)
      if (units.length === 0) return []
      return [stepWithUnits(step, units)]
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

  const updateCellProp = useCallback((val: string | number | boolean, prop: 'opacity' | 'color' | 'trailColor' | 'glow' | 'trail' | 'size' | 'shape') => {
    if (scopeKeys.size === 0) return

    updatePath(path.map((step) => {
      const shouldPromoteToStep = (prop === 'color' || prop === 'trailColor' || prop === 'trail')
        && selectedKeysCoverGroupedUnit(step, scopeKeys)

      return {
        ...step,
        ...(shouldPromoteToStep ? { [prop]: val } : {}),
        units: getStepUnits(step).map((unit) => ({
          ...unit,
          cells: unit.cells.map((cell) => (
            scopeKeys.has(k(cell.row, cell.col)) ? { ...cell, [prop]: val } : cell
          )),
        })),
        cells: getStepCells(step).map((cell) => (
          scopeKeys.has(k(cell.row, cell.col)) ? { ...cell, [prop]: val } : cell
        )),
        tracks: undefined,
      }
    }))
  }, [path, scopeKeys, updatePath])

  const removeCellProp = useCallback((prop: 'color' | 'trailColor' | 'glow' | 'trail' | 'size' | 'shape') => {
    if (scopeKeys.size === 0) return

    updatePath(path.map((step) => {
      const copyStep = { ...step }
      if ((prop === 'color' || prop === 'trailColor' || prop === 'trail') && selectedKeysCoverGroupedUnit(step, scopeKeys)) {
        delete copyStep[prop]
      }

      return {
        ...copyStep,
        units: getStepUnits(step).map((unit) => ({
          ...unit,
          cells: unit.cells.map((cell) => {
            if (!scopeKeys.has(k(cell.row, cell.col))) return cell
            const copy = { ...cell }
            delete copy[prop]
            return copy
          }),
        })),
        cells: getStepCells(step).map((cell) => {
          if (!scopeKeys.has(k(cell.row, cell.col))) return cell
          const copy = { ...cell }
          delete copy[prop]
          return copy
        }),
        tracks: undefined,
      }
    }))
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

  const handleMotionTypeChange = useCallback((motionType: MotionType) => {
    if (!activePath) return

    updatePath(path.map((step, index) => {
      if (index !== safeActivePathIndex) return step
      if (motionType === 'fill') return { ...step, motionMode: 'fill', accumulate: true }

      const activeCount = motionType === 'one'
        ? 1
        : Math.min(Math.max(step.activeCount ?? 2, 2), Math.max(1, getStepUnits(step).length))

      return {
        ...step,
        motionMode: 'window',
        accumulate: false,
        activeCount,
        play: 'one-by-one',
      }
    }))
  }, [activePath, path, safeActivePathIndex, updatePath])

  const handleActiveCountChange = useCallback((count: number) => {
    if (!activePath) return

    updatePath(path.map((step, index) => (
      index === safeActivePathIndex
        ? {
          ...step,
          motionMode: 'window',
          accumulate: false,
          activeCount: Math.max(1, Math.min(count, getStepUnits(step).length)),
          play: 'one-by-one',
        }
        : step
    )))
  }, [activePath, path, safeActivePathIndex, updatePath])

  const handleSetStartCells = useCallback(() => {
    if (!activePath || selectedKeys.length === 0) return

    const selectedKeySet = new Set(selectedKeys)
    const selectedStartUnit = getStepUnits(activePath).find((unit) => (
      unit.cells.length > 1 && unit.cells.some((cell) => selectedKeySet.has(k(cell.row, cell.col)))
    ))
    const startCells = getStepCells(activePath)
      .filter((cell) => selectedKeySet.has(k(cell.row, cell.col)))
      .map((cell) => ({ row: cell.row, col: cell.col }))

    if (startCells.length === 0) return

    updatePath(path.map((step, index) => (
      index === safeActivePathIndex
        ? {
          ...step,
          startCells,
          ...(selectedStartUnit
            ? {
              motionMode: 'window' as const,
              accumulate: false,
              activeCount: 1,
              play: 'one-by-one' as const,
            }
            : {}),
        }
        : step
    )))
  }, [activePath, path, safeActivePathIndex, selectedKeys, updatePath])

  const handleClearStartCells = useCallback(() => {
    if (!activePath) return

    updatePath(path.map((step, index) => {
      if (index !== safeActivePathIndex) return step
      const copy = { ...step }
      delete copy.startCells
      return copy
    }))
  }, [activePath, path, safeActivePathIndex, updatePath])

  const handleUngroup = useCallback(() => {
    if (!activePath) return
    updatePath(path.map((step, index) => (
      index === safeActivePathIndex
        ? { ...step, buildAs: 'singles', pattern: undefined, units: getStepCells(step).map((cell) => ({ id: newUnitId(), cells: [cell] })) }
        : step
    )))
  }, [activePath, path, safeActivePathIndex, updatePath])

  const undoLast = useCallback(() => {
    const nextPath = path.map((step) => stepWithUnits(step, getStepUnits(step)))
    const index = Math.min(safeActivePathIndex, nextPath.length - 1)

    if (index < 0) return
    const step = nextPath[index]
    const nextUnits = getStepUnits(step).slice(0, -1)

    if (nextUnits.length === 0) nextPath.splice(index, 1)
    else nextPath[index] = stepWithUnits(step, nextUnits)

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
    const trailColors = new Map<string, string>()
    const shapes = new Map<string, CellShape>()
    const glows = new Map<string, number>()
    const sizes = new Map<string, number>()
    for (const step of path) {
      const cells = getStepCells(step)
      for (const c of cells) {
        const key = k(c.row, c.col)
        if (c.color) colors.set(key, c.color)
        if (c.trailColor) trailColors.set(key, c.trailColor)
        if (c.shape) shapes.set(key, c.shape)
        const g = c.glow ?? step.glow
        if (g != null && g > 0) glows.set(key, g)
        const s = c.size ?? step.size
        if (s != null && s !== 1) sizes.set(key, s)
      }
    }
    return { colors, trailColors, shapes, glows, sizes }
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
  const activeUnitCount = activePath ? getStepUnits(activePath).length : 0
  const showCreateGroup = selectedCount >= 2
  const activeUnitOrientations = useMemo(() => (
    activePath ? getStepUnits(activePath).map((unit) => unitOrientation(unit.cells)) : []
  ), [activePath])
  const activeMotionOptions = useMemo(() => {
    if (!activeIsGroup) return MOTION_OPTIONS.filter((option) => option.value === 'clicked' || option.value === 'together')
    const hasColumn = activeUnitOrientations.includes('column')
    const hasRow = activeUnitOrientations.includes('row')
    const allowed = new Set<MotionMode>(['clicked', 'together', 'diagonal', 'pulse'])
    if (hasColumn || hasRow) {
      allowed.add('wave-lr')
      allowed.add('wave-rl')
    } else {
      allowed.add('wave-lr')
      allowed.add('wave-rl')
      allowed.add('wave-tb')
      allowed.add('wave-bt')
    }
    return MOTION_OPTIONS.filter((option) => allowed.has(option.value))
  }, [activeIsGroup, activeUnitOrientations])
  const activeMotionValue = useMemo(() => {
    const current = getMotionMode(activePath)
    return activeMotionOptions.some((option) => option.value === current)
      ? current
      : activeMotionOptions[0]?.value ?? 'clicked'
  }, [activeMotionOptions, activePath])
  const activeStartSet = useMemo(() => new Set(
    activePath?.startCells?.map((cell) => k(cell.row, cell.col)) ?? []
  ), [activePath])
  const activeStartLabels = useMemo(() => {
    if (!activePath?.startCells?.length) return []
    const startSet = new Set(activePath.startCells.map((cell) => k(cell.row, cell.col)))
    return getStepUnits(activePath)
      .map((unit, index) => unit.cells.some((cell) => startSet.has(k(cell.row, cell.col))) ? `${labelForPath(safeActivePathIndex)}${index + 1}` : null)
      .filter(Boolean) as string[]
  }, [activePath, safeActivePathIndex])
  const activeHasGroupedStart = useMemo(() => {
    if (!activePath?.startCells?.length) return false
    const startSet = new Set(activePath.startCells.map((cell) => k(cell.row, cell.col)))
    return getStepUnits(activePath).some((unit) => (
      unit.cells.length > 1 && unit.cells.some((cell) => startSet.has(k(cell.row, cell.col)))
    ))
  }, [activePath])
  const showMotionTypeControl = activeUnitCount > 1 && !activeHasGroupedStart
  const showRevealOrderControl = activePath && activeCellCount > 1 && activeMotionOptions.length > 1
  const selectedInActivePath = selectedKeys.some((key) => cellToPlacement.get(key)?.pathIndex === safeActivePathIndex)
  const canSetSelectionStart = Boolean(activePath && selectedInActivePath)
  const hasSelectedOverrides = selectedProps.color !== options.color
    || selectedProps.trailColor !== selectedProps.color
    || selectedProps.glow !== options.glow
    || selectedProps.size !== 1
    || selectedProps.shape != null

  useEffect(() => {
    if (!activePath || activeMotionOptions.length !== 1) return
    const onlyOption = activeMotionOptions[0].value
    if (getMotionMode(activePath) === onlyOption) return
    handleMotionChange(onlyOption)
  }, [activeMotionOptions, activePath, handleMotionChange])

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
      const groupUnit = { id: newUnitId(), cells: selectedCells }

      if (selectedCoversPath) {
        updatePath(path.map((step, stepIndex) => (
          stepIndex === index
            ? {
              ...step,
              cells: selectedCells,
              units: [groupUnit],
              tracks: undefined,
              buildAs: 'group',
              play: 'one-by-one',
              pattern: inferredPatternForCells(selectedCells),
            }
            : step
        )))
        setActivePathIndex(index)
        setSelectedKeys([])
        return
      }

      const nextUnits = getStepUnits(path[index]).flatMap((unit) => {
        const selectedInUnit = unit.cells.filter((cell) => keySet.has(k(cell.row, cell.col)))
        const remainingCells = unit.cells.filter((cell) => !keySet.has(k(cell.row, cell.col)))
        const pieces: CustomAnimationUnit[] = []

        if (selectedInUnit.length > 0 && !pieces.some((piece) => piece === groupUnit)) {
          pieces.push(groupUnit)
        }
        if (remainingCells.length > 0) {
          pieces.push({ ...unit, cells: remainingCells })
        }

        return pieces
      })

      const dedupedUnits = nextUnits.filter((unit, unitIndex) => (
        unit !== groupUnit || nextUnits.findIndex((candidate) => candidate === groupUnit) === unitIndex
      ))

      updatePath(path.map((step, stepIndex) => (
        stepIndex === index
          ? {
            ...stepWithUnits(step, dedupedUnits),
            buildAs: 'group',
            play: 'one-by-one',
            pattern: inferredPatternForCells(selectedCells),
          }
          : step
      )))
      setActivePathIndex(index)
      setSelectedKeys([])
      return
    }

    const basePath = path.flatMap((step) => {
      const remainingUnits = unitsWithoutKeys(step, keySet)
      if (remainingUnits.length === 0) return []
      return [stepWithUnits(step, remainingUnits)]
    })

    const groupUnit = { id: newUnitId(), cells: selectedCells }
    const step: CustomPathStep = {
      cells: selectedCells,
      units: [groupUnit],
      buildAs: 'group',
      play: 'one-by-one',
      pattern: inferredPatternForCells(selectedCells),
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
        ? stepWithUnits(step, [...getStepUnits(step)].reverse())
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
                  const isStartCell = placement?.pathIndex === safeActivePathIndex && activeStartSet.has(key)
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
                      className={`builder-cell tile-${cellShape} ${cellShape === 'triangle' && visualCell.orientation === 'down' ? 'tile-triangle-down' : ''} ${hidden ? 'is-hidden' : ''} ${isSelected ? 'is-selected' : ''} ${placement ? 'has-step' : ''} ${isActivePath ? 'is-active-path' : ''} ${isHoveredPath ? 'is-hovered-path' : ''} ${isIdlePath ? 'is-idle-path' : ''} ${placement?.isGroup ? 'is-group' : ''} ${isStartCell ? 'is-start-cell' : ''}`}
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
                        <>
                          <span className="cell-index" style={customColor ? { background: cellColor, color: '#030303' } : undefined}>
                            {placement.isGroup ? `G${placement.unitIndex + 1}` : placement.cellIndex + 1}
                          </span>
                          {isStartCell && <span className="cell-start-marker" />}
                        </>
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
                      <span>
                        {getStepUnits(step).length === getStepCells(step).length
                          ? `${getStepCells(step).length} cells`
                          : `${getStepUnits(step).length} units / ${getStepCells(step).length} cells`}
                      </span>
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
                      <div className="timing-segment" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={step.timing !== 'simultaneous' ? 'is-active' : ''}
                          onClick={() => step.timing === 'simultaneous' && toggleStepTiming(index)}
                        >
                          After
                        </button>
                        <button
                          type="button"
                          className={step.timing === 'simultaneous' ? 'is-active' : ''}
                          onClick={() => step.timing !== 'simultaneous' && toggleStepTiming(index)}
                        >
                          With previous
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {timingSummary && (
                <p className="timing-summary">{timingSummary}</p>
              )}
            </div>

            <div className="path-actions">
              {activePath && getStepCells(activePath).length > 0 && selectedCount === 0 && activePathIndex < path.length && (
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

          <section className="selection-panel">
            <div className="inspector-row">
              <p className="inspector-label">Selection</p>
              <InfoTip title="Selection">
                <p>Selection is where you edit the current cells or group.</p>
                <p>Use the first row for common actions. More style keeps detailed controls out of the way until needed.</p>
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
                    {hasSelectedOverrides && <span className="selection-chip is-override">Override</span>}
                  </div>
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
                    <div className="quick-action-grid">
                      {showCreateGroup && (
                        <button onClick={handleCreateGroup} className="secondary-action">Group selection</button>
                      )}
                      {canSetSelectionStart && (
                        <button onClick={handleSetStartCells} className="secondary-action">Set start</button>
                      )}
                      {activePath?.startCells?.length ? (
                        <button onClick={handleClearStartCells} className="path-action-secondary">Clear start</button>
                      ) : null}
                      {activeIsGroup && (
                        <button onClick={handleUngroup} className="path-action-secondary">Ungroup</button>
                      )}
                    </div>

                    <div className="selection-style-quick">
                      <div className="inline-control">
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
                      {selectedProps.trail && (
                        <div className="inline-control">
                          <span>Trail color</span>
                          <input
                            type="color"
                            value={selectedProps.trailColor || selectedProps.color}
                            onChange={(e) => updateCellProp(e.target.value, 'trailColor')}
                            aria-label="Selected trail color"
                          />
                          {selectedProps.trailColor !== selectedProps.color && (
                            <button onClick={() => removeCellProp('trailColor')}>Reset</button>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="more-style-toggle"
                      onClick={() => setMoreStyleOpen((open) => !open)}
                    >
                      {moreStyleOpen ? 'Hide more style' : 'More style'}
                    </button>

                    {moreStyleOpen && (
                      <div className="more-style-panel">
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
                          {selectedProps.glow !== options.glow && (
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
                      </div>
                    )}

                    <button onClick={handleRemoveSelected} className="text-button">Remove selected</button>
                  </>
                )}
              </div>
            )}
          </section>

          {activePath && activeCellCount > 1 && (showMotionTypeControl || activeStartLabels.length > 0 || showRevealOrderControl) && (
            <section>
              <div className="inspector-row">
                <p className="inspector-label">Motion</p>
                <InfoTip title="Motion">
                  <p>Motion controls how the active path reveals itself.</p>
                  <p>One active makes a single moving head. Moving group keeps several cells active at once. Fill keeps the progressive reveal.</p>
                  <p>Select numbered cells and click Set start to choose where the motion begins.</p>
                </InfoTip>
              </div>
              {showMotionTypeControl && (
                <label className="select-control">
                  <span>Motion type</span>
                  <select
                    value={getMotionType(activePath)}
                    onChange={(event) => handleMotionTypeChange(event.target.value as MotionType)}
                  >
                    <option value="one">One active</option>
                    <option value="group">Moving group</option>
                    <option value="fill">Fill</option>
                  </select>
                </label>
              )}
              {showMotionTypeControl && getMotionType(activePath) !== 'fill' && (
                <label className="mini-slider">
                  <span>Active steps</span>
                  <input
                    type="range"
                    min={1}
                    max={Math.max(1, activeUnitCount)}
                    step={1}
                    value={Math.min(activePath.activeCount ?? 1, Math.max(1, activeUnitCount))}
                    onChange={(event) => handleActiveCountChange(Number(event.target.value))}
                  />
                  <strong>{Math.min(activePath.activeCount ?? 1, Math.max(1, activeUnitCount))}</strong>
                </label>
              )}
              {activeStartLabels.length > 0 && (
                <div className="selection-basket">
                  {activeStartLabels.map((label) => (
                    <span key={label} className="selection-chip">Start {label}</span>
                  ))}
                </div>
              )}
              {showRevealOrderControl && (
                <label className="select-control">
                  <span>Reveal order</span>
                  <select
                    value={activeMotionValue}
                    onChange={(event) => handleMotionChange(event.target.value as MotionMode)}
                  >
                    {activeMotionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
