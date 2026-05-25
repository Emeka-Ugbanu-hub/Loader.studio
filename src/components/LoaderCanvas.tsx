'use client'

import { useRef, useEffect, useCallback, useMemo } from 'react'
import type { LoaderOptions, CustomPathStep, CellShape } from '@/lib/types'
import { drawCellShape } from '@/lib/drawCell'

interface Props {
  options: LoaderOptions
  frames: number[][][]
  className?: string
  size?: number
  showBgGrid?: boolean
  showLabel?: boolean
  label?: string
  isActive?: boolean
  hiddenCells?: readonly string[]
  customPath?: CustomPathStep[]
}

function k(r: number, c: number) { return `${r},${c}` }

export default function LoaderCanvas({
  options,
  frames,
  className = '',
  size: canvasSize = 280,
  showBgGrid = true,
  showLabel = false,
  label = '',
  isActive = false,
  hiddenCells = [],
  customPath,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)!
  const frameRef = useRef(0)
  const lastTimeRef = useRef(0)
  const accumulatedRef = useRef(0)
  const rafRef = useRef<number>(0)

  const cellGlows = useMemo(() => {
    const m = new Map<string, number>()
    if (customPath) {
      for (const step of customPath) {
        const cells = [step.cells, ...(step.tracks?.map((track) => track.cells) ?? [])].flat()
        for (const c of cells) {
          const g = c.glow ?? step.glow
          if (g != null && g > 0) m.set(k(c.row, c.col), g)
        }
      }
    }
    return m
  }, [customPath])

  const cellColors = useMemo(() => {
    const m = new Map<string, string>()
    if (customPath) {
      for (const step of customPath) {
        const cells = [step.cells, ...(step.tracks?.map((track) => track.cells) ?? [])].flat()
        for (const c of cells)
          if (c.color) m.set(k(c.row, c.col), c.color)
      }
    }
    return m
  }, [customPath])

  const cellShapes = useMemo(() => {
    const m = new Map<string, CellShape>()
    if (customPath) {
      for (const step of customPath) {
        const cells = [step.cells, ...(step.tracks?.map((track) => track.cells) ?? [])].flat()
        for (const c of cells)
          if (c.shape) m.set(k(c.row, c.col), c.shape)
      }
    }
    return m
  }, [customPath])

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, frame: number[][]) => {
    const { gridSize, cellSize, gap, color, shape: globalShape } = options
    const baseTotalSize = gridSize * (cellSize + gap) - gap
    const previewScale = Math.max(1, Math.min(4, (Math.min(w, h) * 0.72) / baseTotalSize))
    const drawCellSize = cellSize * previewScale
    const drawGap = gap * previewScale
    const totalSize = gridSize * (drawCellSize + drawGap) - drawGap
    const ox = (w - totalSize) / 2
    const oy = (h - totalSize) / 2
    const hiddenSet = new Set(hiddenCells)

    ctx.clearRect(0, 0, w, h)

    if (showBgGrid) {
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (hiddenSet.has(`${r},${c}`)) continue
          const bgShape = cellShapes.get(k(r, c)) ?? globalShape
          const x = ox + c * (drawCellSize + drawGap)
          const y = oy + r * (drawCellSize + drawGap)
          ctx.fillStyle = 'rgba(255,255,255,0.08)'
          drawCellShape(ctx, x, y, drawCellSize, bgShape)
        }
      }
    }

    ctx.save()

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (hiddenSet.has(`${r},${c}`)) continue
        const alpha = frame[r]?.[c]
        if (alpha != null && alpha > 0) {
          const key = k(r, c)
          const cellColor = cellColors.get(key) || color
          const cellShape = cellShapes.get(key) ?? globalShape
          const glow = cellGlows.get(key) ?? options.glow
          ctx.globalAlpha = alpha
          ctx.fillStyle = cellColor
          if (glow > 0) {
            ctx.shadowBlur = glow * 2
            ctx.shadowColor = cellColor
          }
          const x = ox + c * (drawCellSize + drawGap)
          const y = oy + r * (drawCellSize + drawGap)
          drawCellShape(ctx, x, y, drawCellSize, cellShape)
          ctx.shadowBlur = 0
        }
      }
    }
    ctx.restore()
  }, [options, showBgGrid, hiddenCells, cellColors, cellGlows, cellShapes])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasSize * dpr
    canvas.height = canvasSize * dpr
    canvas.style.width = `${canvasSize}px`
    canvas.style.height = `${canvasSize}px`
    ctx.scale(dpr, dpr)

    if (!frames.length) return

    frameRef.current = 0
    accumulatedRef.current = 0
    lastTimeRef.current = performance.now()

    function animate(time: number) {
      const delta = time - lastTimeRef.current
      lastTimeRef.current = time
      const frameDuration = 1000 / options.speed

      if (delta > frameDuration * 2) {
        accumulatedRef.current = 0
      } else {
        accumulatedRef.current += delta
      }

      if (accumulatedRef.current >= frameDuration && frames.length > 0) {
        accumulatedRef.current -= frameDuration
        frameRef.current = (frameRef.current + 1) % frames.length
      }

      if (ctx) draw(ctx, canvasSize, canvasSize, frames[frameRef.current])
      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [frames, options.speed, canvasSize, draw, canvasRef])

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <canvas ref={canvasRef} className="block" />
      {showLabel && label && (
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-zinc-500 lowercase tracking-wide">
          {label}
        </span>
      )}
      {isActive && (
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white" />
      )}
    </div>
  )
}
