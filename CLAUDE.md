# Underware Planner: notes for Claude sessions

Browser app for planning openGrid cable management (28 mm tiles) on an infinite SVG canvas, with cables, channels and a bill of materials. React + TypeScript + zustand + Vite, no backend. `README.md` covers features and usage; `CHANGELOG.md` covers history. This file covers how to work on it.

## Commands

- Node 22.12+ (`.nvmrc` pins 22). `npm run dev` serves http://localhost:5173. `npm run build` runs `tsc --noEmit` then the Vite build.
- `npm run check` runs typecheck, ESLint, Prettier check and Vitest. Run it and the build before every commit.
- Unit tests sit next to the code (`*.test.ts`) and use the fixture `src/test/fixtures/layout.json` (every part, every channel shape, cables through channels). Store tests use jsdom. Snapshots pin routing, centerlines and the BOM: an unexpected snapshot change is a behaviour change.
- UI changes still need a browser check (Playwright with a seeded `localStorage` works well, see below), in dark and light schemes.

## Working agreement (the user's standing preferences)

- Be precise and token-efficient. Use bullets, not paragraphs. Don't call tools unnecessarily.
- **Before every commit, update `CHANGELOG.md` (add to `## [Unreleased]`) and `README.md` when the change affects what it describes.**
- Commits: Conventional Commits (commitlint), one short line subject, several small commits rather than one big one. Trailer: `Co-Authored-By: Claude <noreply@anthropic.com>` only. **Never add a `Claude-Session` line.**
- Rewrite files in place; don't leave zips or copies around. Dates are YYYY-MM-DD.

## Concepts

- **World unit = 1 cell = 28 mm** (`CELL_MM`). Everything snaps to integer cells. The canvas `<g>` is translated and scaled by the view.
- **Parts** (`domain/types.ts` `Part`, stored in `doc.objects`): `kind` is `plate` (tile), `object` (custom device), `raceway` (channel) or `cover`. Pieces (channels and covers) have `sub` (`PieceType`), `rot` (quarter turns) and `flip`. The stored field names are the save/export format: don't rename them.
- **Cables**: `{ a, b, waypoints, slackMm, color }`. An anchor is `{ objId, dx, dy }` or a loose `{ x, y }`.
- **Layers** (`tiles`, `objects`, `channels`, `cables`) are a view setting in the store (`hidden`), not part of the layout, export or undo. Hidden layers can't be selected, boxed or nudged, and placing a part shows its layer again.
- **Storage:** `localStorage` key `underware-planner-v1` (`{ doc, view, palette }`). Export and import use `{ version: 1, doc }` JSON.
- **Undo:** `commit(fn, key)` pushes history and coalesces rapid commits that share a `key`. Drags use `beginLive()`, `live(fn)` (no history) and `endLive()` (one step). Undo and redo select what they changed.
- **Selection:** `selection` is the primary item; `selectedIds` / `selectedCableIds` hold everything selected. Actions apply to the multi-selection, else the primary (`targets()` in the store). Components read derived selection through the store's selectors (`selectedPart`, `selectedCable`, `canFlip`, …) with `useShallow`, not whole-store `useStore()`.
- **Derived data:** `routesFor(doc)` and `overlapsFor(doc)` cache per `Doc` object, so every edit must return a new `Doc` (never mutate). Pure layout edits live in `domain/doc.ts`; hooks only translate input into them.

## Where things live (`src/`)

Pure logic (no React) lives in `domain/`, `routing/` and `bom/`; React lives in `features/`, `app/` and `ui/`.

| Path | What |
| --- | --- |
| `domain/types.ts` | `Part`, `Cable`, `Anchor`, `Doc`, `Stamp`/`Block` (placing), `View`, `Selection` |
| `domain/pieces.ts` | Piece catalogue: `PIECE_SHAPES` (outlines as SVG path data), labels, `pieceShape`, `counterpart` (rounded/angled), `stampSize`, `isVertical`/`lengthPatch` (straight orientation) |
| `domain/ports.ts` | `piecePorts` (openings per piece), opening masks and arrows |
| `domain/geometry.ts` | `channelGeometry` (shape plus placing matrix), `channelPorts` |
| `domain/doc.ts`, `group.ts` | Layout edits (`patchPart`, `removePart`, `placeStamp`, …); group move, rotate, clone |
| `domain/anchors.ts`, `migrate.ts`, `sample.ts` | Cable ends and hit tests; old-save migration; first-visit layout |
| `routing/route.ts` | `computeRoutes`: A* between anchors and waypoints, producing the cell path |
| `routing/follow.ts` | `cablePath`: where a cell path runs through a shaped channel (in one opening, out another) it follows that piece's centerline |
| `routing/paths.ts` | Rounded-corner SVG paths and waypoint handle positions |
| `bom/` | Bill of materials and overlap detection |
| `store/store.ts` | zustand store: doc, history, selection, placing state, layers, view |
| `store/persistence.ts`, `view.ts` | Autosave/load; fit, zoom, pointer cell |
| `features/canvas/` | `Canvas` plus `PartShape`, `CableShape`, `SelectionOverlay`, input hooks (`usePointerInput`, `useCableDraft`, `useViewportControls`) |
| `features/panels/` | `LibraryPanel` (left), `InspectorPanel` (right: selection, BOM, cables) |
| `app/` | `App`, `Toolbar`, `SelectionTools`, `LayersMenu`, `useShortcuts`, import/export |
| `ui/` | Shared components: `Icon`, `IconButton`, `PieceThumb`, `Swatches`, `useDismiss` |
| `styles/` | `tokens.css` (light/dark theme variables), `base.css` (type scale, fields, buttons), then layout, toolbar, panels and canvas styles; `index.css` imports them in that order |

## Gotchas

- **Shapes are defined in their own frame** (`PIECE_SHAPES[...].d`, `piecePorts`), then placed by the matrix from `channelGeometry` (rotation, flip, position). New channel types need a shape, ports, a centerline in `routing/follow.ts` (`centerline`), a label, a catalogue entry (`features/panels/catalog.ts`) and test coverage (add it to the fixture).
- **Straight channels** derive orientation from width/height, and from `rot` parity when 1×1 (`isVertical`). Use `lengthPatch` when changing length, and keep `rot` parity in step when rotating.
- **Mirrored chiral parts** (merge/branch, offsets) are different prints, so they are separate BOM entries.
- **Cable path** = cells from `routing/route.ts` plus centerlines from `routing/follow.ts`. Cable length (BOM) is still counted in grid steps (`steps * CELL_MM + slack`), not along the curves. Waypoint handles sit on grid cells.
- Peek mode is just channel group opacity 0.75. Channels are drawn inset (`CHANNEL_INSET`) with their openings flush.
- Chromium and Playwright are in the cloud sandbox: seed `localStorage` with the export JSON via `context.addInitScript`, then `vite preview` and screenshot (dark scheme: `colorScheme: 'dark'`).

## Git in the cloud sandbox

The sandbox can't delete files, so Git leaves `.git/*.lock` and `tmp_obj_*` files behind after writes. If a Git command says another process is running, ask the user to run `find .git -name '*.lock' -delete` in the repo (it only exists because of the sandbox). Never push unless asked.
