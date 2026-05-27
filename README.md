# Loader.studio

Design pixel-grid animated loaders visually in your browser. Export as animated SVG (self-contained, no JavaScript), HTML/CSS, or React component.

**[Open Loader.studio](https://emeka-ugbanu-hub.github.io/Loader.studio/)**

## Features

### 23 Preset Patterns
Spiral, Wave (LR/TB/RL), Pulse, Diagonal, Fill, Snake, Cross, Corners, Plus, Triangle, Line, Checkers, Zigzag, Rings, Hourglass, Arrows, Random, and more — all customizable.

### Custom Builder
- Click empty cells to build animation paths step-by-step
- Group cells with directional motion (wave LR/RL/TB/BT, diagonal, pulse)
- Per-path timing: **Starts after previous** or **Starts with previous**
- Accumulate toggle for preset-like cell persistence
- Reverse cell order, reorder paths with Earlier/Later controls
- Hover path chips to preview cells on the grid

### Grid Layouts
Matrix, Hive (honeycomb), Circular, Isometric, Triangular — control how cells are arranged independently from tile shape.

### Per-Cell Styling (Selected Style Panel)
- **Opacity** — 5–100% per cell
- **Color** — override global accent per cell
- **Glow** — 0–50 intensity, rendered as SVG blur
- **Trail** — per-cell fade effect
- **Size** — 50–200% scale per cell
- **Tile Shape** — square, circle, diamond, triangle, hexagon
- Scope: Selected / Path / All animated

### Global Settings (Default Style Panel)
- Grid size (3×3 to 10×10)
- Tile size, spacing, animation speed
- Accent color, glow, trail toggle
- Tile shape and grid layout

### Export Formats
- **Animated SVG** — self-contained, zero dependencies
- **HTML/CSS** — `<style>` + `<div>` markup
- **React** — JSX component with inline styles
- **Download SVG** — saves as `loader.svg` file

### Quality of Life
- Auto-save draft to browser (restore on reload)
- Open any preset in Custom Builder with one click
- Keyboard shortcuts: Delete (remove selected), Esc (deselect), G (create group)
- Responsive layout with mobile touch targets
- Error boundary for graceful crash recovery

## Interaction

| Action | Result |
|--------|--------|
| Click empty cell | Adds to active path |
| Click numbered cell | Selects for editing |
| Shift + click | Toggles multi-selection |
| Right-click | Masks/unmasks cell |
| 2+ selected → Create group | Groups with wave-lr |
| End path | Closes path; next click starts new |
| **Delete** | Remove selected cells |
| **Esc** | Deselect all |
| **G** | Create group |

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # static export to out/
npm run deploy   # build + push to gh-pages
npm run lint     # lint check
```

Built with Next.js, React, TypeScript, and Tailwind CSS.
