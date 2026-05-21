'use client'

import { useState, useMemo, useCallback } from 'react'
import LoaderCanvas from '@/components/LoaderCanvas'
import ControlsPanel from '@/components/ControlsPanel'
import PresetGrid from '@/components/PresetGrid'
import CustomPatternEditor from '@/components/CustomPatternEditor'
import { patternGenerators, getPresetColor } from '@/lib/patterns'
import { generateLoaderCode } from '@/lib/exporter'
import type { LoaderOptions, CustomPathStep } from '@/lib/types'

const DEFAULT_OPTIONS: LoaderOptions = {
  gridSize: 5,
  cellSize: 14,
  gap: 6,
  color: '#00d4ff',
  glow: 18,
  speed: 8,
  shape: 'square',
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
  const displayOptions = useMemo(() => ({
    ...options,
    color: mode === 'preset' ? getPresetColor(selectedPreset) : options.color,
  }), [options, mode, selectedPreset])

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

  const switchToCustom = useCallback(() => {
    setMode('custom')
  }, [])

  const handleCopyCode = useCallback(() => {
    const code = generateLoaderCode(displayOptions, activeFrames, mode === 'custom' ? customPath : undefined)
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [activeFrames, displayOptions, mode, customPath])

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <header className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl text-cyan-400 font-light">◆</span>
            <h1 className="text-sm font-semibold tracking-tight">Pixel Loader Generator</h1>
          </div>
          <p className="text-xs text-zinc-500 hidden sm:block">Create beautiful animated loaders</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-[360px] xl:w-[400px] flex-shrink-0">
            <div className="sticky top-20 space-y-6">
              <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 flex items-center justify-center">
                <LoaderCanvas
                  options={displayOptions}
                  frames={activeFrames.length > 0 ? activeFrames : [Array.from({ length: options.gridSize }, () => Array(options.gridSize).fill(0))]}
                  size={280}
                  showBgGrid
                  showLabel
                  label={mode === 'preset' ? selectedPreset : 'custom'}
                  hiddenCells={hiddenCells}
                  customPath={mode === 'custom' ? customPath : undefined}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCopyCode}
                  className="flex-1 px-4 py-2.5 text-sm rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition font-medium"
                >
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
              </div>

              <ControlsPanel options={options} onChange={handleOptionsChange} />
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-8">
            <div className="flex items-center gap-4 border-b border-zinc-800 pb-3">
              <button
                onClick={() => setMode('preset')}
                className={`text-sm font-medium pb-1 border-b-2 transition ${
                  mode === 'preset'
                    ? 'text-cyan-400 border-cyan-400'
                    : 'text-zinc-500 border-transparent hover:text-zinc-300'
                }`}
              >
                Presets
              </button>
              <button
                onClick={switchToCustom}
                className={`text-sm font-medium pb-1 border-b-2 transition ${
                  mode === 'custom'
                    ? 'text-cyan-400 border-cyan-400'
                    : 'text-zinc-500 border-transparent hover:text-zinc-300'
                }`}
              >
                Custom
              </button>
            </div>

            {mode === 'preset' ? (
              <PresetGrid
                options={options}
                selected={selectedPreset}
                onSelect={handlePresetSelect}
              />
            ) : (
              <CustomPatternEditor
                options={options}
                frames={customFrames}
                path={customPath}
                hiddenCells={hiddenCells}
                onPathChange={handleCustomPathChange}
                onHiddenCellsChange={handleHiddenCellsChange}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
