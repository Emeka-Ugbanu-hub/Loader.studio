'use client'

import { useMemo } from 'react'
import LoaderCanvas from './LoaderCanvas'
import { patternGenerators, presetNames, getPresetColor } from '@/lib/patterns'
import type { LoaderOptions } from '@/lib/types'

interface Props {
  options: LoaderOptions
  selected: string
  onSelect: (name: string) => void
}

interface PresetCanvasWrapperProps {
  name: string
  options: LoaderOptions
  isActive: boolean
  onSelect: (name: string) => void
}

function PresetCanvasWrapper({ name, options, isActive, onSelect }: PresetCanvasWrapperProps) {
  const frames = useMemo(
    () => patternGenerators[name]?.(options.gridSize) ?? [],
    [name, options.gridSize]
  )

  const thumbnailSize = useMemo(() => {
    const total = options.gridSize * (options.cellSize + options.gap) - options.gap
    return Math.max(total + 8, 72)
  }, [options.gridSize, options.cellSize, options.gap])

  return (
    <button
      onClick={() => onSelect(name)}
      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
        isActive
          ? 'border-cyan-400/60 bg-cyan-400/5 shadow-[0_0_16px_rgba(0,212,255,0.08)]'
          : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-600 hover:bg-zinc-800/40'
      }`}
    >
      <LoaderCanvas
        options={{ ...options, color: getPresetColor(name), speed: 6 }}
        frames={frames}
        size={thumbnailSize}
        showBgGrid
        isActive={false}
      />
      <span className={`text-[10px] lowercase tracking-wide ${
        isActive ? 'text-cyan-400' : 'text-zinc-500'
      }`}>
        {name}
      </span>
    </button>
  )
}

export default function PresetGrid({ options, selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
      {presetNames.map((name) => (
        <PresetCanvasWrapper
          key={name}
          name={name}
          options={options}
          isActive={selected === name}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
