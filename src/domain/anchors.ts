import type { Anchor, Cable, Cell, Doc, Part } from './types';

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

/** What a cable end is attached to: the object's name, or nothing for a loose end. */
function endName(anchor: Anchor, parts: Map<string, Part>): string | null {
  if (anchor.objId === undefined) return null;
  const part = parts.get(anchor.objId);
  return part ? part.name.trim() || 'Device' : null;
}

/** Where a cable goes, e.g. "Router ↔ NAS". Cables have no direction, so no arrow. */
export function cableRoute(cable: Cable, parts: Map<string, Part>): string {
  const a = endName(cable.a, parts);
  const b = endName(cable.b, parts);
  if (!a && !b) return 'Loose cable';
  return `${a ?? 'loose end'} ↔ ${b ?? 'loose end'}`;
}
