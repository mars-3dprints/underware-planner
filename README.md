# Underware Planner

Infinite-canvas planner for cable management on openGrid (28 mm tile pitch).

    npm install
    npm run dev      # http://localhost:5173
    npm run build

- Multi-select: drag a box on empty canvas, shift-click, or Ctrl+A; move, rotate, duplicate, copy/paste and delete work on the whole group (cables are selectable too: their points and loose ends move/rotate with the group; cables between selected items come along automatically).
- Tiles (openGrid tiles): any rows × cols; the BOM counts tiles per size (orientation-independent), total cells and connectors.
- Custom objects: any cols × rows footprint, snapped to the grid. R rotates, Ctrl+D duplicates, drag corner handle to resize.
- Channels and covers: channels (straight of any length, turn, 3-way, 4-way, bridge) and tile covers / wall mounts; tile holes are open until a cover is placed. Bill of materials counts tiles, connectors, channels and covers.
- Cables: press C, click an object, click empty cells for waypoints, click another object. Auto-routes orthogonally on the grid around objects (A*, fewest bends); select a cable and drag its line to add waypoints. Length = cells × 28 mm + slack.
- Layout autosaves to localStorage; Export/Import JSON.

Source: src/route.ts (routing), src/store.ts (state + undo), src/Canvas.tsx (canvas), src/Panels.tsx (UI + summary).
