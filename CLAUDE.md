# Underware Planner: notes for Claude sessions

Browser app for planning openGrid cable management (28 mm tiles) on an infinite SVG canvas, with cables, channels and a bill of materials. React + TypeScript + zustand + Vite, no backend. `README.md` covers features and usage; `CHANGELOG.md` covers history. This file covers how to work on it.

## Commands

- Node 22.12+ (`.nvmrc` pins 22). `npm run dev` serves http://localhost:5173. `npm run build` runs `tsc --noEmit` then the Vite build.
- **Releases:** to release X.Y.Z, move the `[Unreleased]` entries under `## [X.Y.Z] - <today>` (leave an empty `[Unreleased]`), run `npm version X.Y.Z --no-git-tag-version`, and commit `chore: bump version to X.Y.Z`. Don't tag by hand: on `main`, `scripts/release.sh` (run by `.github/workflows/release.yml`) tags the commit that set the version and publishes the release from the changelog section. Preview with `DRY_RUN=1 scripts/release.sh`.
- **Deploys:** GitHub Pages (https://mars-3dprints.github.io/underware-planner/) shows the latest release, not `main`: the Release workflow calls `.github/workflows/deploy.yml` (checks, build, publish) only when it published a new release. Merged but unreleased work isn't live until the next version bump. The deploy builds with `--mode release`, which is what makes the top bar show `vX.Y.Z`; every other build (dev server, local `npm run build`) shows `vX.Y.Z+dev`. Builds and `vite preview` use the base path `/underware-planner/`; the dev server uses `/`.
- `npm run check` runs typecheck, ESLint, Prettier check and Vitest. Run it and the build before every commit.
- Unit tests sit next to the code (`*.test.ts`) and use the fixture `src/test/fixtures/layout.json` (every part, every channel shape, cables through channels). Store tests use jsdom. Snapshots pin routing, centerlines and the BOM: an unexpected snapshot change is a behaviour change.
- UI changes still need a browser check (Playwright with a seeded `localStorage` works well, see below), in dark and light schemes.

## Working agreement (the user's standing preferences)

- Be precise and token-efficient. Use bullets, not paragraphs. Don't call tools unnecessarily.
- **Before every commit, update `CHANGELOG.md` (add to `## [Unreleased]`) and `README.md` when the change affects what it describes.**
- Changelog entries are concise: one line each where possible, saying what changed for the user. No implementation detail, file lists or how it was verified.
- Commits: Conventional Commits (commitlint), one short line subject, several small commits rather than one big one. Trailer: `Co-Authored-By: Claude <noreply@anthropic.com>` only. **Never add a `Claude-Session` line.**
- `CONTRIBUTING.md` and `.github/pull_request_template.md` restate these rules for human contributors: keep them in sync when the workflow changes.
- Rewrite files in place; don't leave zips or copies around. Dates are YYYY-MM-DD.

## Concepts

- **World unit = 1 cell = 28 mm** (`CELL_MM`). Everything snaps to integer cells. The canvas `<g>` is translated and scaled by the view.
- **Parts** (`domain/types.ts` `Part`, stored in `doc.objects`): `kind` is `plate` (tile), `object` (custom device), `raceway` (channel) or `snap` (parts that clip into a tile hole, `SNAP_SHAPES`). Pieces (channels and snaps) have `sub` (`PieceType`), `rot` (quarter turns; a snap keeps only the turns that look different) and `flip`. The stored field names are the save/export format: don't rename them.
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
| `features/panels/` | `LibraryPanel` (left), `InspectorPanel` (right: BOM, cables), `SelectionCard` (floating, draggable selection details) |
| `app/` | `App`, `Toolbar`, `SelectionTools`, `LayersMenu`, `useShortcuts`, import/export |
| `ui/` | Shared components: `Icon`, `IconButton`, `PieceThumb`, `Swatches`, `useDismiss` |
| `styles/` | `tokens.css` (light/dark theme variables), `base.css` (type scale, fields, buttons), then layout, toolbar, panels and canvas styles; `index.css` imports them in that order |

## Gotchas

- **Shapes are defined in their own frame** (`PIECE_SHAPES[...].d`, `piecePorts`), then placed by the matrix from `channelGeometry` (rotation, flip, position). New channel types need a shape (`PIECE_SHAPES`, or `pieceShape` for ones sized by length), ports (`piecePorts`), a centerline in `routing/follow.ts` (`centerline`) when they have two or more openings, a label, a place in `CHANNEL_FAMILIES` (the library and BOM order) and test coverage (add it to the fixture).
- **Straight channels** derive orientation from width/height, and from `rot` parity when 1×1 (`isVertical`). Use `lengthPatch` when changing length, and keep `rot` parity in step when rotating. Bridges, half bridges, open and end channels are sized the same way (`isLinear`) but have a shape, so `rot` also picks their low end, open side or end.
- **Mirrored chiral parts** (merge/branch, offsets, short turn) are different prints, so they are separate BOM entries.
- **Cable path** = cells from `routing/route.ts` plus centerlines from `routing/follow.ts`. Cable length (BOM) is still counted in grid steps (`steps * CELL_MM + slack`), not along the curves. Waypoint handles sit on grid cells.
- Peek mode is just channel group opacity 0.75. Channels are drawn inset (`CHANNEL_INSET`) with their openings flush.
- Chromium and Playwright are in the cloud sandbox: seed `localStorage` with the export JSON via `context.addInitScript`, then `vite preview` (served at `/underware-planner/`) and screenshot (dark scheme: `colorScheme: 'dark'`).

## Git in the cloud sandbox

The sandbox can't delete files, so Git leaves `.git/*.lock` and `tmp_obj_*` files behind after writes. If a Git command says another process is running, ask the user to run `find .git -name '*.lock' -delete` in the repo (it only exists because of the sandbox). Never push unless asked.
