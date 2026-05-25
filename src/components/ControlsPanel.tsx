'use client'

import type { CellShape, GridLayout, LoaderOptions } from '@/lib/types'

interface Props {
  options: LoaderOptions
  onChange: (update: Partial<LoaderOptions>) => void
  colorLocked?: boolean
}

const SHAPES: CellShape[] = ['square', 'circle', 'diamond', 'triangle', 'hexagon']
const LAYOUTS: GridLayout[] = ['square', 'honeycomb', 'circle', 'triangle', 'diamond', 'hex']

export default function ControlsPanel({ options, onChange, colorLocked = false }: Props) {
  return (
    <div className="controls-panel">
      <div className="panel-head compact">
        <div>
          <p className="eyebrow">Style</p>
          <h3 className="panel-title small">Default style</h3>
        </div>
      </div>

      <div className="control-stack">
        <ControlSlider
          label="Grid"
          hint="cells"
          value={options.gridSize}
          min={3}
          max={10}
          onChange={(v) => onChange({ gridSize: v })}
        />
        <ControlSlider
          label="Tile"
          hint="px"
          value={options.cellSize}
          min={4}
          max={24}
          onChange={(v) => onChange({ cellSize: v })}
        />
        <ControlSlider
          label="Spacing"
          hint="px"
          value={options.gap}
          min={2}
          max={20}
          onChange={(v) => onChange({ gap: v })}
        />
        <ControlSlider
          label="Speed"
          hint="fps"
          value={options.speed}
          min={1}
          max={24}
          onChange={(v) => onChange({ speed: v })}
        />
        <ControlSlider
          label="Glow"
          value={options.glow}
          min={0}
          max={50}
          step={2}
          onChange={(v) => onChange({ glow: v })}
        />
      </div>

      <div className="control-row">
        <div>
          <span className="control-label">Trail</span>
          <p className="control-note">Fade recent motion behind the active cells</p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ trail: !options.trail })}
          className={`toggle-switch ${options.trail ? 'is-active' : ''}`}
          aria-pressed={options.trail}
          aria-label="Toggle trail"
        >
          <span />
        </button>
      </div>

      <div className="control-row">
        <div>
          <label className="control-label" htmlFor="loader-color">Accent</label>
          <p className="control-note">{colorLocked ? 'Presets choose their own color' : options.color}</p>
        </div>
        <input
          id="loader-color"
          type="color"
          value={options.color}
          disabled={colorLocked}
          onChange={(e) => onChange({ color: e.target.value })}
          className="color-input"
          aria-label="Accent color"
        />
      </div>

      <div>
        <div className="control-label mb-2">Layout</div>
        <p className="control-note mb-2">Grid structure</p>
        <div className="shape-grid">
          {LAYOUTS.map((layout) => (
            <button
              key={layout}
              onClick={() => onChange({ gridLayout: layout })}
              className={`shape-button ${options.gridLayout === layout ? 'is-active' : ''}`}
              title={layout}
              aria-label={`Use ${layout} layout`}
            >
              {layout === 'square' ? '◻' : layout === 'honeycomb' ? '⬡' : layout === 'circle' ? '◯' : layout === 'triangle' ? '△' : layout === 'diamond' ? '◇' : '⬢'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="control-label mb-2">Tile shape</div>
        <p className="control-note mb-2">Each cell shape</p>
        <div className="shape-grid">
          {SHAPES.map((shape) => (
            <button
              key={shape}
              onClick={() => onChange({ shape })}
              className={`shape-button ${options.shape === shape ? 'is-active' : ''}`}
              title={shape}
              aria-label={`Use ${shape} tiles`}
            >
              <ShapeIcon shape={shape} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ControlSlider({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
}) {
  return (
    <label className="slider-control">
      <span className="flex items-center justify-between gap-3">
        <span className="control-label">{label}</span>
        <span className="control-value">{value}{hint ? ` ${hint}` : ''}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range-input"
      />
    </label>
  )
}

function ShapeIcon({ shape }: { shape: CellShape }) {
  return <span className={`shape-icon shape-${shape}`} />
}
