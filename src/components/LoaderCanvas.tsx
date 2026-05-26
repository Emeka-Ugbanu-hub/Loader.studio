'use client'

import { useRef, useEffect, useCallback, useMemo } from 'react'
import type { LoaderOptions, CustomPathStep } from '@/lib/types'
import { drawCellShape } from '@/lib/drawCell'
import { getCellMap, getVisualGrid, layoutCellShape } from '@/lib/gridLayout'
import { getDisplayCellSize } from '@/lib/displaySizing'
import { cellKey, extractCellProps } from '@/lib/utils'

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

  const cellProps = useMemo(
    () => customPath ? extractCellProps(customPath) : { colors: new Map(), shapes: new Map(), glows: new Map(), sizes: new Map() },
    [customPath]
  )

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, frame: number[][]) => {
    const { gridSize, cellSize, gap, color, layout = 'matrix' } = options
    const globalShape = layoutCellShape(layout, options.shape)
    const availableSize = Math.min(w, h) * 0.92
    const baseCellSize = getDisplayCellSize(gridSize, cellSize, 440)
    const baseGap = gap
    const baseGrid = getVisualGrid(layout, gridSize, baseCellSize, baseGap)
    const fitScale = Math.min(1, availableSize / Math.max(baseGrid.width, baseGrid.height))
    const drawCellSize = baseCellSize * fitScale
    const drawGap = baseGap * fitScale
    const visualGrid = getVisualGrid(layout, gridSize, drawCellSize, drawGap)
    const cellMap = getCellMap(visualGrid)
    const ox = (w - visualGrid.width) / 2
    const oy = (h - visualGrid.height) / 2
    const hiddenSet = new Set(hiddenCells)

    ctx.clearRect(0, 0, w, h)

    if (showBgGrid) {
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (hiddenSet.has(`${r},${c}`)) continue
          const visualCell = cellMap.get(cellKey(r, c))
          if (!visualCell?.visible) continue
          const bgShape = cellProps.shapes.get(cellKey(r, c)) ?? globalShape
          const x = ox + visualCell.x
          const y = oy + visualCell.y
          ctx.fillStyle = 'rgba(255,255,255,0.08)'
          drawCellShape(ctx, x, y, drawCellSize, bgShape, visualCell.orientation)
        }
      }
    }

    ctx.save()

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (hiddenSet.has(`${r},${c}`)) continue
        const visualCell = cellMap.get(cellKey(r, c))
        if (!visualCell?.visible) continue
        const alpha = frame[r]?.[c]
        if (alpha != null && alpha > 0) {
          const key = cellKey(r, c)
          const cellColor = cellProps.colors.get(key) || color
          const cellShape = cellProps.shapes.get(key) ?? globalShape
          const glow = cellProps.glows.get(key) ?? options.glow
          ctx.globalAlpha = alpha
          ctx.fillStyle = cellColor
          if (glow > 0) {
            ctx.shadowBlur = glow * 2
            ctx.shadowColor = cellColor
          }
          const x = ox + visualCell.x
          const y = oy + visualCell.y
          const size = cellProps.sizes.get(key) ?? 1
          const adjustedSize = drawCellSize * size
          const sx = x + (drawCellSize - adjustedSize) / 2
          const sy = y + (drawCellSize - adjustedSize) / 2
          drawCellShape(ctx, sx, sy, adjustedSize, cellShape, visualCell.orientation)
          ctx.shadowBlur = 0
        }
      }
    }
    ctx.restore()
  }, [options, showBgGrid, hiddenCells, cellProps])

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
