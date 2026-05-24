'use client'

import { useCallback, useMemo, useState } from 'react'
import LoaderCanvas from '@/components/LoaderCanvas'
import ControlsPanel from '@/components/ControlsPanel'
import PresetGrid from '@/components/PresetGrid'
import CustomPatternEditor from '@/components/CustomPatternEditor'
import BrandLogo from '@/components/BrandLogo'
import { generateLoaderCode } from '@/lib/exporter'
import { applyTrailToFrames, getPresetColor, patternGenerators } from '@/lib/patterns'
import type { CustomPathStep, LoaderOptions } from '@/lib/types'

const DEFAULT_OPTIONS: LoaderOptions = {
  gridSize: 5,
  cellSize: 14,
  gap: 6,
  color: '#ffffff',
  trail: false,
  speed: 8,
  shape: 'square',
}

function emptyFrame(size: number) {
  return Array.from({ length: size }, () => Array(size).fill(0))
}

export default function Home() {
  const [options, setOptions] = useState<LoaderOptions>(DEFAULT_OPTIONS)
  const [selectedPreset, setSelectedPreset] = useState('spiral')
  const [mode, setMode] = useState<'preset' | 'custom'>('preset')
  const [customPath, setCustomPath] = useState<CustomPathStep[]>([])
  const [customFrames, setCustomFrames] = useState<number[][][]>([])
  const [hiddenCells, setHiddenCells] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  const presetFrames = useMemo(
    () => patternGenerators[selectedPreset]?.(options.gridSize) ?? [],
    [selectedPreset, options.gridSize]
  )

  const activeFrames = mode === 'preset' ? presetFrames : customFrames
  const safeFrames = useMemo(
    () => activeFrames.length > 0 ? activeFrames : [emptyFrame(options.gridSize)],
    [activeFrames, options.gridSize]
  )
  const trailedFrames = useMemo(
    () => applyTrailToFrames(safeFrames, options.trail),
    [safeFrames, options.trail]
  )
  const displayOptions = useMemo(() => ({
    ...options,
    color: mode === 'preset' ? getPresetColor(selectedPreset) : options.color,
  }), [options, mode, selectedPreset])

  const selectedLabel = mode === 'preset'
    ? selectedPreset.replace(/-/g, ' ')
    : customPath.length > 0
      ? 'custom sequence'
      : 'blank custom'

  const handleOptionsChange = useCallback((update: Partial<LoaderOptions>) => {
    setOptions((prev) => ({ ...prev, ...update }))
  }, [])

  const handlePresetSelect = useCallback((name: string) => {
    setSelectedPreset(name)
    setMode('preset')
  }, [])

  const handleCustomPathChange = useCallback((path: CustomPathStep[], frames: number[][][]) => {
    setCustomPath(path)
    setCustomFrames(frames)
  }, [])

  const handleHiddenCellsChange = useCallback((hidden: string[]) => {
    setHiddenCells(hidden)
  }, [])

  const handleCopyCode = useCallback(() => {
    const code = generateLoaderCode(displayOptions, trailedFrames, mode === 'custom' ? customPath : undefined)
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [displayOptions, trailedFrames, mode, customPath])

  return (
    <div className="studio-shell min-h-screen text-neutral-100">
      <header className="studio-topbar sticky top-0 z-40">
        <div className="mx-auto flex h-16 w-full max-w-[1520px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <BrandLogo />
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-neutral-400 md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            Live preview
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1520px] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(330px,390px)_1fr] lg:px-8 lg:py-6">
        <aside className="studio-panel studio-preview-panel lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Output</p>
              <h2 className="panel-title">{selectedLabel}</h2>
            </div>
            <span className="status-pill">{trailedFrames.length} frames</span>
          </div>

          <div className="preview-stage">
            <LoaderCanvas
              options={displayOptions}
              frames={trailedFrames}
              size={300}
              showBgGrid
              hiddenCells={mode === 'custom' ? hiddenCells : []}
              customPath={mode === 'custom' ? customPath : undefined}
            />
          </div>

          <div className="preview-meta">
            <div>
              <span>Grid</span>
              <strong>{options.gridSize} x {options.gridSize}</strong>
            </div>
            <div>
              <span>Speed</span>
              <strong>{options.speed} fps</strong>
            </div>
            <div>
              <span>Shape</span>
              <strong>{options.shape}</strong>
            </div>
            <div>
              <span>Trail</span>
              <strong>{options.trail ? 'on' : 'off'}</strong>
            </div>
          </div>

          <button onClick={handleCopyCode} className="primary-action">
            {copied ? 'Code copied' : 'Copy embed code'}
          </button>

          <ControlsPanel
            options={options}
            onChange={handleOptionsChange}
            colorLocked={mode === 'preset'}
          />
        </aside>

        <section className="studio-panel min-w-0 overflow-hidden">
          <div className="studio-hero">
            <div className="min-w-0">
              <p className="eyebrow">Create</p>
              <h2 className="text-2xl font-medium text-white sm:text-3xl">Build a loader visually.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
                Start from a polished preset or draw your own animation path. Preview, style, and export stay in one place.
              </p>
            </div>

            <div className="mode-switch" role="tablist" aria-label="Builder mode">
              <button
                onClick={() => setMode('preset')}
                className={`mode-button ${mode === 'preset' ? 'is-active' : ''}`}
                role="tab"
                aria-selected={mode === 'preset'}
              >
                Preset library
              </button>
              <button
                onClick={() => setMode('custom')}
                className={`mode-button ${mode === 'custom' ? 'is-active' : ''}`}
                role="tab"
                aria-selected={mode === 'custom'}
              >
                Custom builder
              </button>
            </div>
          </div>

          <div className="px-3 pb-3 sm:px-5 sm:pb-5">
            {mode === 'preset' ? (
              <PresetGrid
                options={options}
                selected={selectedPreset}
                onSelect={handlePresetSelect}
              />
            ) : (
              <CustomPatternEditor
                options={options}
                frames={trailedFrames}
                path={customPath}
                hiddenCells={hiddenCells}
                onPathChange={handleCustomPathChange}
                onHiddenCellsChange={handleHiddenCellsChange}
              />
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
