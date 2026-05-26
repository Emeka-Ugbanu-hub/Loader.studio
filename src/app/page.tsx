'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import LoaderCanvas from '@/components/LoaderCanvas'
import ControlsPanel from '@/components/ControlsPanel'
import PresetGrid from '@/components/PresetGrid'
import CustomPatternEditor from '@/components/CustomPatternEditor'
import BrandLogo from '@/components/BrandLogo'
import { generateLoaderSVG } from '@/lib/svgExporter'
import { applyTrailToFrames, generateCustomFrames, patternGenerators, presetToCustomPath } from '@/lib/patterns'
import type { CustomPathStep, LoaderOptions } from '@/lib/types'
import { layoutCellShape } from '@/lib/gridLayout'

const DRAFT_KEY = 'loader-studio:draft:v1'

interface DraftData {
  options: LoaderOptions
  mode: 'preset' | 'custom'
  selectedPreset: string
  customPath: CustomPathStep[]
  hiddenCells: string[]
}

const DEFAULT_OPTIONS: LoaderOptions = {
  gridSize: 5,
  cellSize: 14,
  gap: 6,
  color: '#ffffff',
  trail: false,
  speed: 8,
  glow: 0,
  shape: 'square',
  layout: 'matrix',
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
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saved' | 'restored'>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const draft: DraftData = JSON.parse(raw)
      const draftOptions = draft.options ? { ...DEFAULT_OPTIONS, ...draft.options } : undefined
      /* eslint-disable react-hooks/set-state-in-effect */
      if (draftOptions) setOptions(draftOptions)
      if (draft.mode) setMode(draft.mode)
      if (draft.selectedPreset) setSelectedPreset(draft.selectedPreset)
      if (draft.customPath) {
        setCustomPath(draft.customPath)
        setCustomFrames(generateCustomFrames(draft.customPath, draftOptions?.gridSize ?? DEFAULT_OPTIONS.gridSize))
      }
      if (draft.hiddenCells) setHiddenCells(draft.hiddenCells)
      /* eslint-enable react-hooks/set-state-in-effect */
      setTimeout(() => setDraftStatus('restored'), 0)
    } catch {
      // ignore corrupted drafts
    }
  }, [])

  const restoredRef = useRef(false)
  useEffect(() => {
    if (draftStatus === 'restored' && !restoredRef.current) {
      restoredRef.current = true
      const timer = setTimeout(() => setDraftStatus('idle'), 100)
      return () => clearTimeout(timer)
    }
  }, [draftStatus])

  useEffect(() => {
    if (draftStatus === 'restored') return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const draft: DraftData = { options, mode, selectedPreset, customPath, hiddenCells }
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
        setDraftStatus('saved')
      } catch {
        // quota exceeded or storage unavailable
      }
    }, 600)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, mode, selectedPreset, customPath, hiddenCells])

  const presetFrames = useMemo(
    () => patternGenerators[selectedPreset]?.(options.gridSize) ?? [],
    [selectedPreset, options.gridSize]
  )

  const activeFrames = mode === 'preset' ? presetFrames : customFrames
  const safeFrames = useMemo(
    () => activeFrames.length > 0 ? activeFrames : [emptyFrame(options.gridSize)],
    [activeFrames, options.gridSize]
  )
  const trailCellKeys = useMemo(() => {
    if (!customPath.length) return false as const
    const set = new Set<string>()
    for (const step of customPath) {
      const cells = [step.cells, ...(step.tracks?.map((t) => t.cells) ?? [])].flat()
      for (const c of cells) {
        const t = c.trail ?? step.trail
        if (t === true) set.add(`${c.row},${c.col}`)
      }
    }
    return set
  }, [customPath])

  const trailedFrames = useMemo(
    () => applyTrailToFrames(safeFrames, options.trail && mode === 'preset' ? true : trailCellKeys),
    [safeFrames, options.trail, trailCellKeys, mode]
  )
  const displayOptions = useMemo(() => ({
    ...options,
    color: options.color,
  }), [options])

  const layoutLabel = useMemo(() => {
    const label = options.layout ?? 'matrix'
    return label.charAt(0).toUpperCase() + label.slice(1)
  }, [options.layout])

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

  const handleOpenPresetInCustom = useCallback((name: string) => {
    const path = presetToCustomPath(name, options.gridSize)
    setCustomPath(path)
    setCustomFrames(generateCustomFrames(path, options.gridSize))
    setMode('custom')
  }, [options.gridSize])

  const handleCustomPathChange = useCallback((path: CustomPathStep[], frames: number[][][]) => {
    setCustomPath(path)
    setCustomFrames(frames)
  }, [])

  const handleHiddenCellsChange = useCallback((hidden: string[]) => {
    setHiddenCells(hidden)
  }, [])

  const handleCopySVG = useCallback(() => {
    const svg = generateLoaderSVG(displayOptions, trailedFrames, mode === 'custom' ? customPath : undefined, hiddenCells)
    navigator.clipboard.writeText(svg).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [displayOptions, trailedFrames, mode, customPath, hiddenCells])

  const handleDownloadSVG = useCallback(() => {
    const svg = generateLoaderSVG(displayOptions, trailedFrames, mode === 'custom' ? customPath : undefined, hiddenCells)
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'loader.svg'
    a.click()
    URL.revokeObjectURL(url)
  }, [displayOptions, trailedFrames, mode, customPath, hiddenCells])

  return (
    <div className="studio-shell min-h-screen text-neutral-100">
      <header className="studio-topbar sticky top-0 z-40">
        <div className="mx-auto flex h-16 w-full max-w-[1520px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <BrandLogo />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-neutral-400 md:flex">
              <span className={`h-1.5 w-1.5 rounded-full ${draftStatus === 'saved' || draftStatus === 'restored' ? 'bg-emerald-400' : 'bg-white/40'}`} />
              {draftStatus === 'restored' ? 'Restored draft' : draftStatus === 'saved' ? 'Saved' : 'Live preview'}
            </div>
            <a
              href="https://github.com/Emeka-Ugbanu-hub/Loader.studio"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-neutral-400 transition hover:border-white/25 hover:text-white"
            >
              GitHub
            </a>
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
              <span>Layout</span>
              <strong>{layoutLabel}</strong>
            </div>
            <div>
              <span>Speed</span>
              <strong>{options.speed} fps</strong>
            </div>
            <div>
              <span>Shape</span>
              <strong>{layoutCellShape(options.layout ?? 'matrix', options.shape)}</strong>
            </div>
            <div>
              <span>Trail</span>
              <strong>{options.trail ? 'on' : 'off'}</strong>
            </div>
          </div>

          <div className="export-actions">
            <button onClick={handleCopySVG} className="primary-action">
              {copied ? 'SVG copied' : 'Copy SVG'}
            </button>
            <button onClick={handleDownloadSVG} className="primary-action">
              Download
            </button>
          </div>

          <ControlsPanel
            options={options}
            onChange={handleOptionsChange}
          />
        </aside>

        <section className="studio-panel studio-builder-panel min-w-0 overflow-hidden">
          <div className="studio-hero">
            <div className="min-w-0">
              <p className="eyebrow">Create</p>
              <h2 className="text-2xl font-medium text-white sm:text-3xl">Loader workspace</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
                Pick a preset or draw paths directly on the grid. Preview, style, and export stay in one place.
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
                onOpenInCustom={handleOpenPresetInCustom}
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
