'use client'

import { useMemo, useState } from 'react'
import LoaderCanvas from './LoaderCanvas'
import { applyTrailToFrames, getPresetColor, patternGenerators, presetNames } from '@/lib/patterns'
import type { LoaderOptions } from '@/lib/types'

interface Props {
  options: LoaderOptions
  selected: string
  onSelect: (name: string) => void
}

const PRESET_DETAILS: Record<string, { label: string; mood: string; group: 'Paths' | 'Waves' | 'Bursts' }> = {
  spiral: { label: 'Spiral', mood: 'Guided reveal', group: 'Paths' },
  corners: { label: 'Corners', mood: 'Edge sparkle', group: 'Bursts' },
  plus: { label: 'Plus', mood: 'Center cross', group: 'Paths' },
  triangle: { label: 'Triangle', mood: 'Stacked build', group: 'Paths' },
  'wave-lr': { label: 'Wave left', mood: 'Column sweep', group: 'Waves' },
  'wave-tb': { label: 'Wave down', mood: 'Top sweep', group: 'Waves' },
  'wave-rl': { label: 'Wave right', mood: 'Reverse sweep', group: 'Waves' },
  'tl-br': { label: 'Diagonal line', mood: 'Clean trace', group: 'Paths' },
  'i-left': { label: 'Line', mood: 'Minimal pass', group: 'Paths' },
  'left-right': { label: 'Split sides', mood: 'Dual rails', group: 'Waves' },
  striangle: { label: 'Stair triangle', mood: 'Rising edge', group: 'Paths' },
  scorners: { label: 'Corner pulse', mood: 'Center echo', group: 'Bursts' },
  pulse: { label: 'Pulse', mood: 'Radial bloom', group: 'Bursts' },
  diagonal: { label: 'Diagonal wave', mood: 'Soft scan', group: 'Waves' },
  fill: { label: 'Fill', mood: 'Full reveal', group: 'Bursts' },
  snake: { label: 'Snake', mood: 'Serpentine', group: 'Paths' },
  cross: { label: 'Cross', mood: 'Sharp mark', group: 'Bursts' },
}

const GROUPS = ['All', 'Paths', 'Waves', 'Bursts'] as const

function getDetails(name: string) {
  return PRESET_DETAILS[name] ?? {
    label: name.replace(/-/g, ' '),
    mood: 'Motion preset',
    group: 'Paths' as const,
  }
}

function PresetCard({
  name,
  options,
  isActive,
  onSelect,
}: {
  name: string
  options: LoaderOptions
  isActive: boolean
  onSelect: (name: string) => void
}) {
  const frames = useMemo(
    () => applyTrailToFrames(patternGenerators[name]?.(options.gridSize) ?? [], options.trail),
    [name, options.gridSize, options.trail]
  )
  const details = getDetails(name)

  return (
    <button
      onClick={() => onSelect(name)}
      className={`preset-card ${isActive ? 'is-active' : ''}`}
      aria-pressed={isActive}
    >
      <div className="preset-canvas">
        <LoaderCanvas
          options={{ ...options, color: getPresetColor(name), speed: 7 }}
          frames={frames}
          size={132}
          showBgGrid
          isActive={isActive}
        />
      </div>
      <span className="preset-info">
        <span>
          <strong>{details.label}</strong>
          <small>{details.mood}</small>
        </span>
        <span className="preset-tag">{details.group}</span>
      </span>
    </button>
  )
}

export default function PresetGrid({ options, selected, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<(typeof GROUPS)[number]>('All')

  const filteredPresets = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return presetNames.filter((name) => {
      const details = getDetails(name)
      const matchesGroup = group === 'All' || details.group === group
      const haystack = `${name} ${details.label} ${details.mood} ${details.group}`.toLowerCase()
      return matchesGroup && (!normalized || haystack.includes(normalized))
    })
  }, [query, group])

  return (
    <div className="workspace-flow">
      <div className="library-toolbar">
        <div className="search-field">
          <span aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search presets"
            aria-label="Search presets"
          />
        </div>
        <div className="filter-tabs" aria-label="Preset groups">
          {GROUPS.map((item) => (
            <button
              key={item}
              onClick={() => setGroup(item)}
              className={group === item ? 'is-active' : ''}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="preset-grid">
        {filteredPresets.map((name) => (
          <PresetCard
            key={name}
            name={name}
            options={options}
            isActive={selected === name}
            onSelect={onSelect}
          />
        ))}
      </div>

      {filteredPresets.length === 0 && (
        <div className="empty-state">
          <strong>No presets found</strong>
          <span>Try another search or switch groups.</span>
        </div>
      )}
    </div>
  )
}
