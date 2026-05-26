export type CellShape = 'square' | 'circle' | 'diamond' | 'triangle' | 'hexagon'
export type GridLayout = 'matrix' | 'hive' | 'circular' | 'isometric' | 'triangular'

export interface LoaderOptions {
  gridSize: number
  cellSize: number
  gap: number
  color: string
  trail: boolean
  speed: number
  glow: number
  shape: CellShape
  layout: GridLayout
}

export interface Pattern {
  name: string
  frames: number[][][]
}

export interface CustomPathPoint {
  row: number
  col: number
  opacity?: number
  color?: string
  glow?: number
  trail?: boolean
  shape?: CellShape
  size?: number
}

export type MovementPattern = 'wave-lr' | 'wave-rl' | 'wave-tb' | 'wave-bt' | 'diagonal' | 'pulse'

export interface CustomParallelTrack {
  cells: CustomPathPoint[]
  pattern?: MovementPattern
}

export interface CustomPathStep {
  cells: CustomPathPoint[]
  opacity?: number
  color?: string
  glow?: number
  trail?: boolean
  shape?: CellShape
  size?: number
  pattern?: MovementPattern
  buildAs?: 'group' | 'singles'
  play?: 'together' | 'one-by-one'
  timing?: 'sequence' | 'simultaneous'
  accumulate?: boolean
  tracks?: CustomParallelTrack[]
}

export interface HiddenCell {
  row: number
  col: number
}

export const DEFAULT_OPTIONS: LoaderOptions = {
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
