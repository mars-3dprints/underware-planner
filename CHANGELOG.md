# Changelog

All notable changes to Underware Planner. Dates are YYYY-MM-DD.

## [0.2.0] - 2026-10-12

### Added

- **Cables follow channel shapes.** Where a cable runs through a shaped channel, entering through one opening and leaving through another, it follows that piece's own centerline: the real radius of each rounded turn, the diagonal of angled turns and offsets, the S-curve of rounded offsets, and the quarter-arcs of junctions, forks, merges and short turns. Outside channels cables keep the orthogonal look. Nothing extra is stored: it is derived when drawing, so moving or deleting a channel puts the cable back to its default route (`src/follow.ts`).
- **See-through mode** (eye button in the top bar, or **P**): draws channels at 75 % opacity so the cables underneath stay visible.
- **Switch rounded / angled** (toolbar button, or **T**): swaps a selected channel, or the part being placed, for its counterpart with the same size and openings. Works for turns, merge/branch, offsets and forks.
- **Arrow-key nudge:** arrow keys move the selection one cell, Shift moves five. Works on parts and cables, and groups move together.
- README screenshot (`docs/screenshot.png`), shown in dark theme.

### Changed

- **Live ghost edits:** while placing a tile or custom object, changes to its name, size or colour show on the ghost immediately, and keep any rotation already applied.
- Straight-channel length edits (panel field and drag handle) keep the channel's orientation.
- **README rewritten** to describe the project: what it is, what it does, the parts, usage, shortcuts, saving and sharing, and a project layout.

### Fixed

- A 1×1 straight channel always rendered horizontal. Straights now take their orientation from rotation when they are square, and rotating a straight updates it.
- A stray character in `store.ts` that broke the build.

## [0.1.0] - 2026-10-11

Initial release.

### Canvas and editing

- Infinite SVG canvas on a 28 mm grid with pan, zoom and fit-to-content. Dark theme follows the system setting.
- Selection by click, Shift-click and box select. Move, rotate, flip, copy and paste, duplicate and delete work on whole groups, including cables.
- Undo and redo, which re-select the parts they changed.
- A contextual toolbar for the current selection, including a colour picker that applies when you click away.
- Left panel for placing parts with a live ghost, and a show/hide button for the bill-of-materials sidebar.

### Parts

- **Tiles** of any rows × columns, with tile covers (hole cover, wall mount). Holes stay open until a cover is placed.
- **Custom objects** of any footprint, named, coloured and resizable, with presets for common devices.
- **Channels:** straight (any length), bridge (3 cells or more, passes over other channels), rounded and angled turns (1–12 cells), short turn, 3-way junction, 4-way junction (3×3 and compact 1×1), rounded and angled forks, merge/branch and offsets in rounded and angled forms with mirrored versions. Channels are drawn slightly inset with their openings flush.
- Colours: a default palette that cannot be removed, plus custom colours you add.

### Cables

- Draw a cable between two objects or loose ends. It auto-routes orthogonally around obstacles with an A* search that prefers the fewest bends.
- Waypoints can be added by dragging the cable line, moved, deleted one at a time, or all reset. Cables have their own name, colour and slack.
- Cable length is cells × 28 mm plus slack.

### Bill of materials

- Tiles by size (orientation-independent), total cells, connectors, channels (mirrored parts counted separately), covers, objects and cable lengths, with a copy-as-text button.
- Overlapping channels are flagged with a dashed outline.

### Saving

- Autosave to `localStorage` (`underware-planner-v1`) and JSON export and import.
- Built with React 18, TypeScript, zustand and Vite, with `.gitignore` and a short README.
