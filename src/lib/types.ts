export type CellShape = 'square' | 'circle' | 'diamond' | 'triangle' | 'hexagon'

export interface LoaderOptions {
  gridSize: number
  cellSize: number
  gap: number
  color: string
  glow: number
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
  glow?: number
  shape?: CellShape
}

export type MovementPattern = 'wave-lr' | 'wave-rl' | 'wave-tb' | 'wave-bt' | 'diagonal' | 'pulse'

export interface CustomPathStep {
  cells: CustomPathPoint[]
  opacity?: number
  color?: string
  glow?: number
  shape?: CellShape
  pattern?: MovementPattern
}

export interface HiddenCell {
  row: number
  col: number
}

export const DEFAULT_OPTIONS: LoaderOptions = {
  gridSize: 5,
  cellSize: 14,
  gap: 6,
  color: '#00d4ff',
  glow: 18,
  speed: 8,
  shape: 'square',
}
