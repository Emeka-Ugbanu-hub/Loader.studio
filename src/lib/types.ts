export type CellShape = 'square' | 'circle' | 'diamond' | 'triangle' | 'hexagon'

export interface LoaderOptions {
  gridSize: number
  cellSize: number
  gap: number
  color: string
  trail: boolean
  speed: number
  shape: CellShape
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
  shape?: CellShape
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
  shape?: CellShape
  pattern?: MovementPattern
  buildAs?: 'group' | 'singles'
  play?: 'together' | 'one-by-one'
  timing?: 'sequence' | 'simultaneous'
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
  shape: 'square',
}
