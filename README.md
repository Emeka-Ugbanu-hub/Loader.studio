# Loader.studio

A visual pixel-grid loader generator for the web. Select cells, build custom animation paths, and export standalone HTML/JS loaders — no dependencies.

## Features

- **Preset patterns** — spiral, pulse, wave, fill, snake, and more
- **Custom builder** — click cells to build your own animation step by step
- **Groups** — select multiple cells and animate them together with directional waves (left, right, top, bottom, diagonal, pulse)
- **Per-cell styling** — override color, opacity, glow, and shape on individual cells
- **Hidden cells** — right-click cells to hide them from the animation
- **Live preview** — see your animation as you build it
- **Export** — copy standalone HTML/JS code to use anywhere

### Shapes

Each cell can be rendered as **square**, **circle**, **diamond**, **triangle**, or **hexagon** — set globally or per cell.

## Usage

1. Pick a **preset** from the grid or switch to **Custom** mode
2. Click cells to add them to your animation path
3. **Shift+click** to select multiple cells without adding to the path
4. Click **Group selected cells** to create a multi-cell step with directional animation
5. Use the **Cell Style** panel to customize color, opacity, glow, and shape per cell
6. Adjust global settings (speed, color, glow, shape) in the sidebar
7. Click **Copy Code** to export your loader

### Interaction

| Action | Result |
|--------|--------|
| Click empty cell | Creates a step, selects the cell |
| Click cell in group | Selects the entire group |
| Shift+click any cell | Toggles that cell in/out of selection |
| Right-click cell | Hides/unhides the cell |
| Click Group button | Merges selected cells into a group step with wave-lr animation |
| Click direction button | Changes the group's animation direction |

## Development

```bash
npm install
npm run dev      # development server
npm run build    # static export to out/
npm run lint     # lint check
```

Built with [Next.js](https://nextjs.org), React, TypeScript, and Tailwind CSS.

## Deploy

The project includes a GitHub Actions workflow that builds and deploys to GitHub Pages automatically when pushing to `main`. Set the repo's Pages source to **GitHub Actions** and the workflow handles the rest.

If deploying to a different sub-path, set `NEXT_PUBLIC_BASE_PATH` (e.g., `/my-loader`) in the build step.
