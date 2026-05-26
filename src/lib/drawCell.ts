import type { CellShape } from './types'

export function drawCellShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  shape: CellShape,
  orientation: 'up' | 'down' = 'up',
) {
  const h = size / 2
  switch (shape) {
    case 'square':
      ctx.fillRect(x, y, size, size)
      break
    case 'circle':
      ctx.beginPath()
      ctx.arc(x + h, y + h, h, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'diamond':
      ctx.beginPath()
      ctx.moveTo(x + h, y)
      ctx.lineTo(x + size, y + h)
      ctx.lineTo(x + h, y + size)
      ctx.lineTo(x, y + h)
      ctx.closePath()
      ctx.fill()
      break
    case 'triangle':
      ctx.beginPath()
      if (orientation === 'down') {
        ctx.moveTo(x, y)
        ctx.lineTo(x + size, y)
        ctx.lineTo(x + h, y + size)
      } else {
        ctx.moveTo(x + h, y)
        ctx.lineTo(x + size, y + size)
        ctx.lineTo(x, y + size)
      }
      ctx.closePath()
      ctx.fill()
      break
    case 'hexagon': {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6
        const px = x + h + h * Math.cos(angle)
        const py = y + h + h * Math.sin(angle)
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
      break
    }
  }
}
