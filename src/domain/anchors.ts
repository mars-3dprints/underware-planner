import type { Anchor, Cell, Doc, Part } from './types';

export const sameCell = (a: Cell | null | undefined, b: Cell | null | undefined) =>
  !!a && !!b && a.x === b.x && a.y === b.y;

export const contains = (part: Part, cell: Cell) =>
  cell.x >= part.x && cell.x < part.x + part.w && cell.y >= part.y && cell.y < part.y + part.h;

export const sameAnchor = (a: Anchor, b: Anchor) => JSON.stringify(a) === JSON.stringify(b);

export const partsById = (parts: Part[]) => new Map(parts.map((p) => [p.id, p]));

/** Cell of a cable end, or null when its part is gone. */
export function anchorCell(anchor: Anchor, partsById: Map<string, Part>): Cell | null {
  if (anchor.objId === undefined) return { x: anchor.x, y: anchor.y };
  const part = partsById.get(anchor.objId);
  return part ? { x: part.x + anchor.dx, y: part.y + anchor.dy } : null;
}

/** Topmost custom object on a cell (cables attach to these); none while the objects layer is hidden. */
export function deviceAt(doc: Doc, cell: Cell, devicesHidden = false): Part | undefined {
  if (devicesHidden) return undefined;
  for (let i = doc.objects.length - 1; i >= 0; i--) {
    const part = doc.objects[i];
    if (part.kind === 'object' && contains(part, cell)) return part;
  }
}

/** Cable end for a cell: attached to the custom object there, or loose. */
export function anchorAt(doc: Doc, cell: Cell, devicesHidden = false): Anchor {
  const device = deviceAt(doc, cell, devicesHidden);
  return device
    ? { objId: device.id, dx: cell.x - device.x, dy: cell.y - device.y }
    : { x: cell.x, y: cell.y };
}
