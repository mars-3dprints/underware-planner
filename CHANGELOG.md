# Changelog

All notable changes to Underware Planner. Dates are YYYY-MM-DD.

## [Unreleased]

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
