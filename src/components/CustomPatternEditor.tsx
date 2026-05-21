'use client'

import { useCallback, useState, useMemo } from 'react'
import type { CustomPathStep, LoaderOptions, MovementPattern, CellShape } from '@/lib/types'
import { generateCustomFrames } from '@/lib/patterns'
import LoaderCanvas from './LoaderCanvas'

interface Props {
  options: LoaderOptions
  frames: number[][][]
  path: CustomPathStep[]
  hiddenCells: string[]
  onPathChange: (path: CustomPathStep[], frames: number[][][]) => void
  onHiddenCellsChange: (hidden: string[]) => void
}

function k(r: number, c: number) { return `${r},${c}` }

const DIRECTIONS: { key: MovementPattern | undefined; label: string; icon: string }[] = [
  { key: undefined, label: 'Together', icon: '⊞' },
  { key: 'wave-lr', label: 'Left', icon: '←' },
  { key: 'wave-rl', label: 'Right', icon: '→' },
  { key: 'wave-tb', label: 'Top', icon: '↑' },
  { key: 'wave-bt', label: 'Bottom', icon: '↓' },
  { key: 'diagonal', label: 'Diagonal', icon: '↘' },
  { key: 'pulse', label: 'Pulse', icon: '◎' },
]

export default function CustomPatternEditor({ options, frames, path, hiddenCells, onPathChange, onHiddenCellsChange }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const hiddenSet = useMemo(() => new Set(hiddenCells), [hiddenCells])

  const cellToStep = useMemo(() => {
    const m = new Map<string, number>()
    for (let i = 0; i < path.length; i++)
      for (const c of path[i].cells) m.set(k(c.row, c.col), i)
    return m
  }, [path])

  const groupStepIdx = path.findIndex((s) => s.cells.length > 1)
  const hasGroup = groupStepIdx !== -1

  const selProps = useMemo(() => {
    let opacity = 100
    let color = options.color
    let glow: number | undefined
    let shape: CellShape | undefined
    for (const key of selected) {
      for (const step of path) {
        for (const c of step.cells) {
          if (k(c.row, c.col) === key) {
            if (c.opacity != null) opacity = c.opacity
            if (c.color) color = c.color
            if (c.glow != null) glow = c.glow
            if (c.shape) shape = c.shape
          }
        }
      }
    }
    return { opacity, color, glow, shape }
  }, [selected, path, options.color])

  const handleClick = useCallback((r: number, c: number, shift: boolean) => {
    if (hiddenSet.has(k(r, c))) return
    const key = k(r, c)
    const inPath = cellToStep.has(key)
    const inGroup = inPath && path[cellToStep.get(key)!].cells.length > 1

    if (shift) {
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key); else next.add(key)
        return next
      })
    } else {
      if (!inPath) {
        const newStep: CustomPathStep = { cells: [{ row: r, col: c }] }
        const newPath = [...path, newStep]
        onPathChange(newPath, generateCustomFrames(newPath, options.gridSize))
      }
      const ents = inGroup
        ? path[cellToStep.get(key)!].cells.map((cc) => k(cc.row, cc.col))
        : [key]
      setSelected(new Set(ents))
    }
  }, [hiddenSet, cellToStep, path, options.gridSize, onPathChange])

  const handleGroup = useCallback(() => {
    if (selected.size < 2) return
    const cells = Array.from(selected).map((key) => {
      const [r, c] = key.split(',').map(Number)
      for (const step of path) {
        for (const cc of step.cells) {
          if (cc.row === r && cc.col === c) return { row: r, col: c, opacity: cc.opacity, color: cc.color, glow: cc.glow, shape: cc.shape }
        }
      }
      return { row: r, col: c }
    })

    const removeSteps = new Set<number>()
    for (const key of selected) {
      const si = cellToStep.get(key)
      if (si !== undefined) removeSteps.add(si)
    }

    const newPath = path.filter((_, i) => !removeSteps.has(i))
    newPath.push({ cells, pattern: 'wave-lr' })
    onPathChange(newPath, generateCustomFrames(newPath, options.gridSize))
    setSelected(new Set())
  }, [selected, path, cellToStep, options.gridSize, onPathChange])

  const handleDirection = useCallback((dir: MovementPattern | undefined) => {
    if (groupStepIdx === -1) return
    const newPath = path.map((s, i) => i === groupStepIdx ? { ...s, pattern: dir } : s)
    onPathChange(newPath, generateCustomFrames(newPath, options.gridSize))
  }, [path, groupStepIdx, options.gridSize, onPathChange])

  const handleUngroup = useCallback(() => {
    if (groupStepIdx === -1) return
    const s = path[groupStepIdx]
    const newPath = path.flatMap((step, i) =>
      i === groupStepIdx
        ? s.cells.map((c) => ({ cells: [{ row: c.row, col: c.col, opacity: c.opacity, color: c.color, glow: c.glow, shape: c.shape }] }))
        : [step]
    )
    onPathChange(newPath, generateCustomFrames(newPath, options.gridSize))
    setSelected(new Set())
  }, [path, groupStepIdx, options.gridSize, onPathChange])

  const updateCellProp = useCallback((val: string | number, prop: 'opacity' | 'color' | 'glow' | 'shape') => {
    if (selected.size === 0) return
    const newPath = path.map((step) => ({
      ...step,
      cells: step.cells.map((c) =>
        selected.has(k(c.row, c.col)) ? { ...c, [prop]: val } : c
      ),
    }))
    onPathChange(newPath, generateCustomFrames(newPath, options.gridSize))
  }, [selected, path, options.gridSize, onPathChange])

  const removeCellProp = useCallback((prop: 'color' | 'glow' | 'shape') => {
    if (selected.size === 0) return
    const newPath = path.map((step) => ({
      ...step,
      cells: step.cells.map((c) => {
        if (!selected.has(k(c.row, c.col))) return c
        const copy = { ...c }
        delete copy[prop]
        return copy
      }),
    }))
    onPathChange(newPath, generateCustomFrames(newPath, options.gridSize))
  }, [selected, path, options.gridSize, onPathChange])

  const undo = useCallback(() => {
    onPathChange([], [])
    setSelected(new Set())
  }, [onPathChange])

  const clearAll = useCallback(() => {
    onPathChange([], [])
    setSelected(new Set())
    onHiddenCellsChange([])
  }, [onPathChange, onHiddenCellsChange])

  const hideCell = useCallback((r: number, c: number) => {
    const key = k(r, c)
    onHiddenCellsChange(hiddenSet.has(key) ? hiddenCells.filter((h) => h !== key) : [...hiddenCells, key])
  }, [hiddenCells, hiddenSet, onHiddenCellsChange])

  const ecs = Math.floor(Math.min(320 / options.gridSize - 4, 40))
  const canGroup = selected.size >= 2

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-medium text-zinc-300">Custom Builder</h3>
        <button onClick={undo} disabled={path.length === 0} className="px-3 py-1 text-xs rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-30 disabled:pointer-events-none transition">Undo</button>
        <button onClick={clearAll} disabled={path.length === 0 && hiddenCells.length === 0} className="px-3 py-1 text-xs rounded-lg border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-500/50 disabled:opacity-30 disabled:pointer-events-none transition">Clear</button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
        <span>{path.length} step{path.length !== 1 ? 's' : ''}</span>
        {hasGroup && <span className="text-emerald-400">· Group active</span>}
        <span>· Right-click to hide</span>
        <span>· Shift+click to select</span>
      </div>

      {(selected.size > 0 || hasGroup) && (
        <div className="w-full max-w-sm flex flex-col items-center gap-2 px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/40">
          {selected.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400">{selected.size} selected</span>
              <button onClick={() => setSelected(new Set())} className="px-2 py-1 text-[10px] rounded border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition">Deselect</button>
            </div>
          )}

          {canGroup && (
            <button onClick={handleGroup} className="px-4 py-1.5 text-xs rounded-lg bg-cyan-500/15 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/25 transition font-medium">
              Group selected cells
            </button>
          )}

          {hasGroup && (
            <div className="flex flex-col items-center gap-1.5 w-full pt-1 border-t border-zinc-800">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">Group direction</span>
              <div className="flex flex-wrap justify-center gap-1.5">
                {DIRECTIONS.map((d) => {
                  const grp = path[groupStepIdx]
                  const active = (grp.pattern ?? undefined) === d.key
                  return (
                    <button
                      key={d.label}
                      onClick={() => handleDirection(d.key)}
                      className={`px-2.5 py-1.5 text-xs rounded-lg border transition ${
                        active
                          ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.15)]'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                      }`}
                    >
                      <span className="mr-1">{d.icon}</span>
                      {d.label}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-2 mt-1">
                <button onClick={handleUngroup} className="px-3 py-1 text-[10px] rounded border border-zinc-700 text-zinc-500 hover:text-amber-400 hover:border-amber-500/50 transition">
                  Ungroup
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {selected.size === 0 && !hasGroup && (
        <span className="text-[11px] text-zinc-500">Click cells to animate · Shift+click to select · Group for multi-cell steps</span>
      )}

      <div className="grid place-items-center select-none">
        <div className="relative" style={{ display: 'grid', gridTemplateColumns: `repeat(${options.gridSize}, ${ecs}px)`, gap: '4px' }}>
          {Array.from({ length: options.gridSize }, (_, r) =>
            Array.from({ length: options.gridSize }, (_, c) => {
              const h = hiddenSet.has(k(r, c))
              const s = selected.has(k(r, c))
              const si = cellToStep.get(k(r, c))
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={(e) => handleClick(r, c, e.shiftKey)}
                  onContextMenu={(e) => { e.preventDefault(); hideCell(r, c) }}
                  className={`relative flex items-center justify-center rounded transition-all ${
                    h
                      ? 'bg-zinc-900/20 border border-dashed border-zinc-700/30'
                      : s
                        ? 'bg-cyan-400/25 border-2 border-cyan-400 shadow-[0_0_10px_rgba(0,212,255,0.3)]'
                        : si !== undefined
                          ? 'bg-cyan-400/15 border border-cyan-400/40'
                          : 'bg-zinc-800/40 border border-zinc-700/50 hover:border-zinc-500 hover:bg-zinc-700/30'
                  }`}
                  style={{ width: ecs, height: ecs }}
                >
                  {h && <svg className="w-3 h-3 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
                  {si !== undefined && !h && !s && <span className="text-[10px] font-mono font-bold text-cyan-400">{si + 1}</span>}
                  {s && <span className="text-[10px] font-mono font-bold text-white">{si !== undefined ? si + 1 : 'S'}</span>}
                </button>
              )
            })
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="w-full max-w-sm flex flex-col items-center gap-3 px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/40">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Cell Style</span>

          <label className="flex items-center gap-2 text-xs text-zinc-500 w-full justify-center">
            Opacity
            <input type="range" min={5} max={100} step={5} value={selProps.opacity} onChange={(e) => updateCellProp(Number(e.target.value), 'opacity')} className="w-24 accent-cyan-400" />
            <span className="text-cyan-400 w-7 text-right text-[11px]">{selProps.opacity}%</span>
          </label>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              Color
              <input type="color" value={selProps.color} onChange={(e) => updateCellProp(e.target.value, 'color')} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent" />
            </label>
            {selProps.color !== options.color && (
              <button onClick={() => removeCellProp('color')} className="px-2 py-1 text-[10px] rounded border border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-500/50 transition">
                Reset
              </button>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-500 w-full justify-center">
            Glow
            <input type="range" min={0} max={50} step={1} value={selProps.glow ?? options.glow} onChange={(e) => updateCellProp(Number(e.target.value), 'glow')} className="w-24 accent-cyan-400" />
            <span className="text-cyan-400 w-10 text-right text-[11px]">{selProps.glow ?? options.glow}</span>
            {(selProps.glow != null) && (
              <button onClick={() => removeCellProp('glow')} className="px-2 py-1 text-[10px] rounded border border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-500/50 transition">
                Reset
              </button>
            )}
          </label>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Shape</span>
            {(['square', 'circle', 'diamond', 'triangle', 'hexagon'] as const).map((s) => (
              <button
                key={s}
                onClick={() => updateCellProp(s, 'shape')}
                className={`px-3 py-1 text-xs rounded-lg border transition ${
                  (selProps.shape ?? options.shape) === s
                    ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                }`}
              >
                {s === 'square' ? '■' : s === 'circle' ? '●' : s === 'diamond' ? '◆' : s === 'triangle' ? '▲' : '⬡'}
              </button>
            ))}
            {selProps.shape != null && (
              <button onClick={() => removeCellProp('shape')} className="px-2 py-1 text-[10px] rounded border border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-500/50 transition">
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">Preview</span>
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60">
          <LoaderCanvas
            options={options}
            frames={frames.length > 0 ? frames : [Array.from({ length: options.gridSize }, () => Array(options.gridSize).fill(0))]}
            size={200}
            showBgGrid
            hiddenCells={hiddenCells}
            customPath={path}
          />
        </div>
      </div>
    </div>
  )
}
