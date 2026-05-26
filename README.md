# Loader.studio

Design pixel-grid animated loaders visually in your browser. Export a self-contained animated SVG — no JavaScript, no dependencies.

**[Open Loader.studio](https://emeka-ugbanu-hub.github.io/Loader.studio/)**

## How it works

1. Pick a **preset** (spiral, wave, corners, plus…) or switch to **Custom builder**
2. In Custom mode, click empty cells to build paths. Click **End path** when done. Next click starts a new path.
3. Select cells, then click **Create group** to animate them together with directional motion
4. Use the **Selected style** panel to tweak color, opacity, glow, shape, and trail per cell or per path
5. Copy or download an animated SVG — drops anywhere without code

## Interaction

| Action | Result |
|--------|--------|
| Click empty cell | Adds it to the active path |
| Click numbered cell | Selects that cell for editing |
| Shift + click numbered cell | Toggles cell in/out of multi-selection |
| Right-click cell | Masks/unmasks the cell |
| Select 2+ cells → Create group | Groups them with wave-lr animation |
| End path | Closes current path; next click starts a new one |
| **Delete** key | Remove selected cells |
| **Esc** | Deselect all |
| **G** | Create group from selected cells |

## Styling

- **Tile shape** — square, circle, diamond, triangle, hexagon (global or per cell)
- **Glow** — slider per cell or global, rendered as SVG blur
- **Trail** — per-cell trail effect in custom mode (global toggle for presets)
- **Per-path timing** — each path controls **Starts after** or **Starts with** previous
- **Timing summary** — shows `A + B → C + D` blocks under the path list

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # static export to out/
npm run deploy   # build + push to gh-pages
npm run lint     # lint check
```

Built with Next.js, React, TypeScript, and Tailwind CSS.
