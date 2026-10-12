# Changelog

All notable changes to Underware Planner. Dates are YYYY-MM-DD.

## [Unreleased]

### Added

- Snaps: Multiconnect (a bigger threaded hole), channel base snap (a notch for zip ties) and base compatibility snap (a small threaded stub).
- Junctions: inline 3-way and 4-way (3×1) with openings in the side walls, and an end 3-way (2×1).
- Open channel: a straight of any length, open on both sides of every cell. It replaces the 1×1 4-way junction, which is a 1-cell open channel.
- Open channel (one side): the same, open along one side only; turn it to choose the side.
- End channel: a straight of any length, open at one end only, with its closed end rounded or angled (**T** switches).

### Changed

- The "Tile covers" sections are now called "Snaps", and the plain tile cover is replaced by the channel grip snap. Snaps are drawn as they look, covering most of their tile cell.
- The sidebars use one order: tiles, custom objects, channels, snaps, then cables. Channels in the bill of materials follow the library's groups, and the copied parts list has a separate Snaps section.
- Channels in the bill of materials, the library and the copied parts list drop the repeated "Channel, " prefix ("Turn (rounded)").
- Library and bill-of-materials pictures of shaped channels show where their openings are, as on the canvas.

### Fixed

- Moving a selection that includes cables keeps their shape: they shift with it instead of being rerouted, and only the stretch to an end left on a part that isn't moving is redrawn.
- A 1×1 turn is labelled just "Channel, turn", and counts as one part whichever style it was placed or resized as.
- The short turn has a mirrored version in the library, counted as its own part in the bill of materials.
- Flipping a channel turned sideways mirrored it top to bottom; flipping now always mirrors left to right on screen.

## [0.8.1] - 2026-10-12

### Changed

- Updated the README screenshot.

## [0.8.0] - 2026-10-12

### Added

- Selecting an object highlights the cables connected to it and fades the rest.
- Highlighted cables (hovered, or connected to the selected objects) glow in their own colour.
- The bill of materials shows the colour of each tile, channel and tile cover, with a separate line per colour. The copied text includes it as a hex code.

### Changed

- Tiles can no longer be renamed, like channels; they're labelled "Tile" with their size.
- Custom objects are no longer counted in the bill of materials, and no longer have the "Include in bill of materials" option.

### Fixed

- The dashed box around a multi-selection now covers whole cables, not just their waypoints and loose ends; the size shown in the sidebar matches.

## [0.7.0] - 2026-10-12

### Added

- Hover cables to see which ones share a path: a tooltip lists them and the rest fade. Hovering a cable in the list traces it.
- Each cable shows where it goes (for example `Router ↔ NAS`) in the cable list, the hover tooltip and the copied parts list.
- Drag cables in the cable list (a grip shows on hover) to reorder them; the order sets which cables are drawn on top.

## [0.6.0] - 2026-10-12

### Added

- Links to openGrid and Underware for openGrid on MakerWorld, in the README and a "Related" group in the version menu.
- "Include in bill of materials" checkbox for the selection, to leave out parts you already have. Excluded parts are shown faded.
- **\\** (backslash) shows or hides the sidebar.

## [0.5.0] - 2026-10-12

### Added

- Version shown next to the app name, with links to its release notes, the source and bug reports.
- MIT license.
- Contributing guide, and issue and pull request templates.

### Fixed

- The release workflow stopped after publishing the first missing release.

## [0.4.0] - 2026-10-12

### Added

- Hosted on GitHub Pages, showing the latest release: https://mars-3dprints.github.io/underware-planner/
- GitHub Releases for every version, published automatically from the changelog.
- Logo, favicon and app icons, shown in the README and the top bar.

## [0.3.0] - 2026-10-12

### Added

- **Layers:** show or hide tiles, objects, channels and cables (layers button or **1–4**). Hidden layers can't be selected or edited; placing a part shows its layer again. A view setting only: not saved, exported or undone, and the bill of materials still counts everything.
- **Tooling:** ESLint, Prettier and Vitest, with `lint`, `format`, `test`, `typecheck` and `check` scripts. `.nvmrc` pins Node 22.
- **Unit tests** for routing, channel centerlines, group edits, bill of materials, store actions and save migration, using a fixture with every part.

### Changed

- **Project structure:** `src/` split into `domain/`, `routing/`, `bom/`, `store/`, `features/`, `app/` and `ui/`, with descriptive names and shared helpers. Behaviour and the layout format are unchanged.
- **Styles** split into themed files, with duplicate and unused rules removed.
- **Dependencies:** Vite 8, Vitest 5, React 19 and zustand 5. Requires Node 22.12+.
- Source formatted with Prettier.
- README screenshot retaken with the current UI.

### Removed

- Unused code: opening-arrow paths and the `addonCount` and per-cable `bends` fields in bill-of-materials data.

### Fixed

- Imported files from older versions are now migrated, like autosaved layouts.
- Finishing a cable selects only that cable, so the colour picker no longer paints previously selected parts.
- Esc closes the layers menu and colour popover, keeping the selection.
- F on a part that can't be flipped no longer adds an empty undo step.

## [0.2.0] - 2026-10-12

### Added

- **Cables follow channel shapes:** through a shaped channel, a cable follows the piece's centerline (turns, offsets, junctions, forks, merges). Derived when drawing, nothing extra is stored.
- **See-through mode** (eye button or **P**): channels at 75 % opacity to show cables underneath.
- **Switch rounded / angled** (toolbar or **T**) for turns, merge/branch, offsets and forks, selected or being placed.
- **Arrow-key nudge:** one cell, or five with Shift. Works on parts, cables and groups.
- README screenshot (`docs/screenshot.png`).

### Changed

- Placing a tile or custom object: name, size and colour edits show on the ghost immediately and keep its rotation.
- Straight-channel length edits keep the channel's orientation.
- README rewritten.

### Fixed

- 1×1 straight channels always rendered horizontal; they now follow their rotation.
- A stray character in `store.ts` broke the build.

## [0.1.0] - 2026-10-11

Initial release.

### Canvas and editing

- Infinite SVG canvas on a 28 mm grid with pan, zoom and fit. Dark theme follows the system.
- Click, Shift-click and box selection. Move, rotate, flip, copy, paste, duplicate and delete work on groups, including cables.
- Undo and redo, which re-select what they changed.
- Contextual toolbar for the selection, with a colour picker.
- Left panel for placing parts with a live ghost; the bill-of-materials sidebar can be hidden.

### Parts

- **Tiles** of any size, with hole covers and wall mounts. Holes stay open until covered.
- **Custom objects:** any footprint, named, coloured and resizable, with device presets.
- **Channels:** straight, bridge (3+ cells, passes over channels), rounded and angled turns (1–12 cells), short turn, 3- and 4-way junctions, forks, merge/branch and offsets (rounded and angled, with mirrored versions).
- Default colour palette plus custom colours.

### Cables

- Cables between objects or loose ends, auto-routed around obstacles (A*, fewest bends).
- Waypoints: add by dragging the cable, move, delete or reset. Each cable has a name, colour and slack.
- Length is cells × 28 mm plus slack.

### Bill of materials

- Tiles by size, total cells, connectors, channels (mirrored parts separate), covers, objects and cable lengths, with copy as text.
- Overlapping channels are flagged with a dashed outline.

### Saving

- Autosave to `localStorage` (`underware-planner-v1`), plus JSON export and import.
- Built with React 18, TypeScript, zustand and Vite.
