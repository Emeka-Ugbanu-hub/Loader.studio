'use client'

import type { CellShape, GridLayout, LoaderOptions } from '@/lib/types'
import InfoTip from './InfoTip'

interface Props {
  options: LoaderOptions
  onChange: (update: Partial<LoaderOptions>) => void
  colorLocked?: boolean
}

const SHAPES: CellShape[] = ['square', 'circle', 'diamond', 'triangle', 'hexagon']
const LAYOUTS: { key: GridLayout; label: string; note: string }[] = [
  { key: 'matrix', label: 'Matrix', note: 'Rows and columns' },
  { key: 'hive', label: 'Hive', note: 'Honeycomb hex layout' },
  { key: 'circular', label: 'Circular', note: 'Round cell field' },
  { key: 'isometric', label: 'Isometric', note: 'Angled diamond grid' },
  { key: 'triangular', label: 'Triangular', note: 'Stacked triangle' },
]

const DEFAULT_LAYOUT_SHAPES: Partial<Record<GridLayout, CellShape>> = {
  hive: 'hexagon',
  circular: 'circle',
  isometric: 'diamond',
  triangular: 'triangle',
}

export default function ControlsPanel({ options, onChange, colorLocked = false }: Props) {
  const activeLayout = options.layout ?? 'matrix'

  return (
    <div className="controls-panel">
      <div className="panel-head compact">
        <div>
          <p className="eyebrow">Style</p>
          <h3 className="panel-title small">Default style</h3>
        </div>
        <InfoTip title="Default style">
          <p>These controls set the base look for the whole loader.</p>
          <p>Grid changes how many cells are available. Tile changes cell size. Spacing controls gaps. Speed changes playback. Glow adds light to the final preview/export.</p>
        </InfoTip>
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

      <label className="select-control">
        <span>Layout</span>
        <select
          value={activeLayout}
          onChange={(event) => {
            const layout = event.target.value as GridLayout
            onChange({
              layout,
              ...(DEFAULT_LAYOUT_SHAPES[layout] ? { shape: DEFAULT_LAYOUT_SHAPES[layout] } : {}),
            })
          }}
        >
          {LAYOUTS.map((layout) => (
            <option key={layout.key} value={layout.key}>
              {layout.label} - {layout.note}
            </option>
          ))}
        </select>
      </label>

      <div className="control-row">
        <div>
          <span className="control-label">Trail</span>
          <p className="control-note">Fade recent motion behind the active cells</p>
        </div>
        <InfoTip title="Trail">
          <p>Trail leaves a short fade behind moving cells so motion feels smoother.</p>
          <p>In presets this applies globally. In Custom Builder, use Selected style to apply trail to only selected cells or paths.</p>
        </InfoTip>
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
        <InfoTip title="Accent">
          <p>Accent is the default color for custom loaders.</p>
          <p>Preset colors are locked so each preset keeps its designed look.</p>
        </InfoTip>
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
        <div className="section-title-row mb-2">
          <div className="control-label">Shape</div>
          <InfoTip title="Shape">
            <p>Shape controls the default tile form. Layout controls where tiles are placed.</p>
            <p>Shortcuts: choose the layout structure first, then use Shape or Selected style for cell-level changes.</p>
          </InfoTip>
        </div>
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
