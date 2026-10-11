# Underware Planner: notes for Claude sessions

Browser app for planning openGrid cable management (28 mm tiles) on an infinite SVG canvas, with cables, channels and a bill of materials. React 18 + TypeScript + zustand + Vite, no backend. `README.md` covers features and usage; `CHANGELOG.md` covers history. This file covers how to work on it.

## Commands

- `npm run dev` serves http://localhost:5173. `npm run build` runs `tsc --noEmit` then the Vite build. Run the build before every commit.
- There is no test suite. Verify UI changes in a browser (Playwright with a seeded `localStorage` works well, see below) and check the layout with dark and light schemes.

## Working agreement (the user's standing preferences)

- Be precise and token-efficient. Use bullets, not paragraphs. Don't call tools unnecessarily.
- **Before every commit, update `CHANGELOG.md` (add to `## [Unreleased]`) and `README.md` when the change affects what it describes.**
- Commits: Conventional Commits (commitlint), one short line subject, several small commits rather than one big one. Trailer: `Co-Authored-By: Claude <noreply@anthropic.com>` only. **Never add a `Claude-Session` line.**
- Rewrite files in place; don't leave zips or copies around. Dates are YYYY-MM-DD.

## Concepts

- **World unit = 1 cell = 28 mm** (`CELL_MM`). Everything snaps to integer cells. The canvas `<g>` is translated and scaled by the view.
- **Objects** (`types.ts` `Obj`): `kind` is `plate` (tile), `object` (custom device), `raceway` (channel) or `cover`. Channels have `sub`, `rot` (quarter turns) and `flip`.
- **Cables**: `{ a, b, waypoints, slackMm, color }`. An anchor is `{ objId, dx, dy }` or a loose `{ x, y }`.
- **Layers** (`tiles`, `objects`, `channels`, `cables`) are a view setting in the store (`hidden`), not part of the layout, export or undo. Hidden layers can't be selected, boxed or nudged, and placing a part shows its layer again.
- **Storage:** `localStorage` key `underware-planner-v1` (`{ doc, view, palette }`). Export and import use `{ version: 1, doc }` JSON.
- **Undo:** `commit(fn, key)` pushes history and coalesces rapid commits that share a `key`. `live()` edits without history, for drags. Undo and redo select what they changed.

## Where things live (`src/`)

| File | What |
| --- | --- |
| `types.ts` | Types, `PIECES` (channel outlines as SVG path data), `portsOf` (openings), `pieceOf`, `counterpart` (rounded/angled), `isVert`/`lenPatch` (straight orientation), layers |
| `store.ts` | zustand store: doc, history, selection, placing state (`stamp`/`block`), peek, layers, autosave |
| `Canvas.tsx` | SVG rendering, pointer handling, selection, drags, ghost, marquee |
| `route.ts` | `computeRoutes`: A* between anchors and waypoints, producing the cell path |
| `follow.ts` | `cablePathD`: where a cell path runs through a shaped channel (entering one opening, leaving another) it is replaced by that piece's centerline, so cables follow turns, offsets, merges and junctions |
| `geometry.ts` | `racewayGeom` (shape plus transform matrix), `portsList` |
| `group.ts` | Move, rotate, clone for multi-selections |
| `summary.ts` | Bill of materials and overlap detection |
| `Panels.tsx`, `App.tsx`, `icons.tsx`, `Thumb.tsx`, `styles.css` | UI |

## Gotchas

- **Shapes are defined in their own frame** (`PIECES[...].d`, `portsOf`), then placed by the matrix from `racewayGeom` (rotation, flip, position). New channel types need a shape, ports, a centerline in `follow.ts` (`shapeLine`), a BOM label and a thumbnail.
- **Straight channels** derive orientation from width/height, and from `rot` parity when 1×1 (`isVert`). Use `lenPatch` when changing length, and keep `rot` parity in step when rotating.
- **Mirrored chiral parts** (merge/branch, offsets) are different prints, so they are separate BOM entries.
- **Cable path** = cells from `route.ts` plus centerlines from `follow.ts`. Cable length (BOM) is still counted in grid steps (`steps * CELL_MM + slack`), not along the curves. Waypoint handles sit on grid cells.
- Peek mode is just channel group opacity 0.75. Channels are drawn inset (`INSET`) with their openings flush.
- Chromium and Playwright are in the cloud sandbox: seed `localStorage` with the export JSON via `context.addInitScript`, then `vite preview` and screenshot (dark scheme: `colorScheme: 'dark'`).

## Git in the cloud sandbox

The sandbox can't delete files, so Git leaves `.git/*.lock` and `tmp_obj_*` files behind after writes. If a Git command says another process is running, ask the user to run `find .git -name '*.lock' -delete` in the repo (it only exists because of the sandbox). Never push unless asked.
