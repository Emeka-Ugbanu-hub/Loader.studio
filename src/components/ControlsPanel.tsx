'use client'

import type { LoaderOptions, CellShape } from '@/lib/types'

interface Props {
  options: LoaderOptions
  onChange: (update: Partial<LoaderOptions>) => void
}

export default function ControlsPanel({ options, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900/60">
      <ControlSlider
        label="Grid Size"
        value={options.gridSize}
        min={3}
        max={10}
        onChange={(v) => onChange({ gridSize: v })}
      />
      <ControlSlider
        label="Cell Size"
        value={options.cellSize}
        min={4}
        max={24}
        onChange={(v) => onChange({ cellSize: v })}
      />
      <ControlSlider
        label="Gap"
        value={options.gap}
        min={2}
        max={20}
        onChange={(v) => onChange({ gap: v })}
      />
      <ControlSlider
        label="Glow"
        value={options.glow}
        min={0}
        max={36}
        onChange={(v) => onChange({ glow: v })}
      />
      <ControlSlider
        label="Speed"
        value={options.speed}
        min={1}
        max={24}
        onChange={(v) => onChange({ speed: v })}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={options.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="w-9 h-9 rounded-lg border border-zinc-700 bg-transparent p-0.5 cursor-pointer"
          />
          <span className="text-xs font-mono text-zinc-400">{options.color}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Shape</label>
        <div className="flex gap-2">
          {(['square', 'circle', 'diamond', 'triangle', 'hexagon'] as CellShape[]).map((s) => (
            <button
              key={s}
              onClick={() => onChange({ shape: s })}
              className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-all ${
                options.shape === s
                  ? 'border-cyan-400 bg-cyan-400/10 text-cyan-400'
                  : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
              }`}
            >
              {s === 'square' ? (
                <span className="w-3.5 h-3.5 rounded-sm bg-current" />
              ) : s === 'circle' ? (
                <span className="w-3.5 h-3.5 rounded-full bg-current" />
              ) : s === 'diamond' ? (
                <span className="w-3.5 h-3.5 rotate-45 bg-current" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} />
              ) : s === 'triangle' ? (
                <span className="w-3.5 h-3.5 bg-current" style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }} />
              ) : (
                <span className="w-3.5 h-3.5 bg-current" style={{ clipPath: 'polygon(25% 0%, 75% 0%, 100% 25%, 100% 75%, 75% 100%, 25% 100%, 0% 75%, 0% 25%)' }} />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ControlSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">{label}</label>
        <span className="text-xs font-mono text-zinc-400">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full bg-zinc-800 appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400
          [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,212,255,0.5)]
          [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
      />
    </div>
  )
}
