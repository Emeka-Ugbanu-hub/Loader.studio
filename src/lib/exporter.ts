import type { LoaderOptions, CustomPathStep } from './types'

export function generateLoaderCode(options: LoaderOptions, frames: number[][][], customPath?: CustomPathStep[]): string {
  const { gridSize, cellSize, gap, color, speed, shape } = options
  const totalSize = gridSize * (cellSize + gap) - gap
  const framesJson = JSON.stringify(frames)
  const cellColorsJson = customPath ? buildCellColors(customPath) : 'null'
  const cellShapesJson = customPath ? buildCellShapes(customPath) : 'null'

  return `<canvas id="loader" width="${totalSize}" height="${totalSize}"></canvas>
<script>
const canvas = document.getElementById('loader');
const ctx = canvas.getContext('2d');
const frames = ${framesJson};
const cellColors = ${cellColorsJson};
const cellShapes = ${cellShapesJson};
const defaultColor = '${color}';
const defaultShape = '${shape}';
let frame = 0;
const speed = ${speed};
const gridSize = ${gridSize};
const cellSize = ${cellSize};
const gap = ${gap};
const totalSize = gridSize * (cellSize + gap) - gap;
const dpr = window.devicePixelRatio || 1;

canvas.width = totalSize * dpr;
canvas.height = totalSize * dpr;
canvas.style.width = totalSize + 'px';
canvas.style.height = totalSize + 'px';
ctx.scale(dpr, dpr);

const ox = (totalSize - totalSize) / 2;
const oy = (totalSize - totalSize) / 2;

function cellKey(r, c) { return r + ',' + c; }

function drawCell(ctx, x, y, s, shape) {
  const h = s / 2;
  if (shape === 'square') ctx.fillRect(x, y, s, s);
  else if (shape === 'circle') { ctx.beginPath(); ctx.arc(x + h, y + h, h, 0, Math.PI * 2); ctx.fill(); }
  else if (shape === 'diamond') { ctx.beginPath(); ctx.moveTo(x + h, y); ctx.lineTo(x + s, y + h); ctx.lineTo(x + h, y + s); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill(); }
  else if (shape === 'triangle') { ctx.beginPath(); ctx.moveTo(x + h, y); ctx.lineTo(x + s, y + s); ctx.lineTo(x, y + s); ctx.closePath(); ctx.fill(); }
  else if (shape === 'hexagon') {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = x + h + h * Math.cos(a), py = y + h + h * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }
}

function draw() {
  ctx.clearRect(0, 0, totalSize, totalSize);

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const x = c * (cellSize + gap);
      const y = r * (cellSize + gap);
      const bgShape = (cellShapes && cellShapes[cellKey(r, c)]) || defaultShape;
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      drawCell(ctx, x, y, cellSize, bgShape);
    }
  }

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const alpha = frames[frame][r]?.[c];
      if (alpha != null && alpha > 0) {
        const key = cellKey(r, c);
        const fillColor = (cellColors && cellColors[key]) || defaultColor;
        const cellShape = (cellShapes && cellShapes[key]) || defaultShape;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fillColor;
        const x = c * (cellSize + gap);
        const y = r * (cellSize + gap);
        drawCell(ctx, x, y, cellSize, cellShape);
      }
    }
  }
  ctx.globalAlpha = 1;

  frame = (frame + 1) % frames.length;
  requestAnimationFrame(draw);
}

draw();
</script>`
}

function buildCellColors(path: CustomPathStep[]): Record<string, string> {
  const colors: Record<string, string> = {}
  for (const step of path) {
    const cells = [step.cells, ...(step.tracks?.map((track) => track.cells) ?? [])].flat()
    for (const c of cells)
      if (c.color) colors[`${c.row},${c.col}`] = c.color
  }
  return colors
}

function buildCellShapes(path: CustomPathStep[]): Record<string, string> {
  const shapes: Record<string, string> = {}
  for (const step of path) {
    const cells = [step.cells, ...(step.tracks?.map((track) => track.cells) ?? [])].flat()
    for (const c of cells)
      if (c.shape) shapes[`${c.row},${c.col}`] = c.shape
  }
  return shapes
}
