import { CELL_MM } from '../domain/constants';
import { boundsOf } from '../domain/group';
import { isLinear, isMirrored, isTurn, PIECE_ORDER, pieceLabel, pieceShape } from '../domain/pieces';
import type { Doc, Part, PieceType } from '../domain/types';
import type { Route } from '../routing/route';

interface TileSize {
  rows: number;
  cols: number;
  qty: number;
}

export interface PieceLine {
  sub: PieceType;
  len: number;
  label: string;
  spec: string;
  qty: number;
  order: number;
  mirrored: boolean;
}

export type BillOfMaterials = ReturnType<typeof billOfMaterials>;

/** Lengths and turn sizes, and mirrored prints, are separate bill-of-materials lines. */
function pieceKey(piece: Part & { sub: PieceType }) {
  const len = Math.max(piece.w, piece.h);
  const sized = isLinear(piece.sub) || isTurn(piece.sub);
  return piece.sub + (sized ? ':' + len : '') + (isMirrored(piece) ? ':m' : '');
}

function pieceLine(piece: Part & { sub: PieceType }): PieceLine {
  const { sub } = piece;
  const len = Math.max(piece.w, piece.h);
  const linear = isLinear(sub);
  const mirrored = isMirrored(piece);
  const shape = pieceShape(sub, len);
  const spec = linear
    ? `${len} cells · ${len * CELL_MM} mm`
    : shape
      ? `${shape.w}×${shape.h} cells · ${shape.w * CELL_MM}×${shape.h * CELL_MM} mm`
      : `${CELL_MM} mm`;
  const order = PIECE_ORDER.indexOf(sub) * 1000 + len + (mirrored ? 0.5 : 0);
  return { sub, len, label: pieceLabel(sub, mirrored), spec, qty: 0, order, mirrored };
}

/** Joins between edge-adjacent tiles: one connector per cell of shared edge. */
function countConnectors(tiles: Part[]) {
  let connectors = 0;
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const a = tiles[i];
      const b = tiles[j];
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if ((a.x + a.w === b.x || b.x + b.w === a.x) && overlapY > 0) connectors += overlapY;
      else if ((a.y + a.h === b.y || b.y + b.h === a.y) && overlapX > 0) connectors += overlapX;
    }
  }
  return connectors;
}

export function billOfMaterials(doc: Doc, routes: Map<string, Route>) {
  const tileSizes = new Map<string, TileSize>();
  const pieceLines = new Map<string, PieceLine>();
  const tiles: Part[] = [];
  let cells = 0;
  for (const part of doc.objects) {
    if ((part.kind === 'raceway' || part.kind === 'cover') && part.sub) {
      const piece = part as Part & { sub: PieceType };
      const key = pieceKey(piece);
      const entry = pieceLines.get(key) ?? pieceLine(piece);
      entry.qty++;
      pieceLines.set(key, entry);
      continue;
    }
    if (part.kind !== 'plate') continue;
    const rows = Math.min(part.w, part.h);
    const cols = Math.max(part.w, part.h);
    const key = `${rows}×${cols}`;
    const entry = tileSizes.get(key) ?? { rows, cols, qty: 0 };
    entry.qty++;
    tileSizes.set(key, entry);
    cells += part.w * part.h;
    tiles.push(part);
  }
  const footprint = boundsOf(tiles);
  const sizes = [...tileSizes.values()].sort((a, b) => b.rows * b.cols - a.rows * a.cols || b.rows - a.rows);
  const addons = [...pieceLines.values()].sort((a, b) => a.order - b.order);
  const cables = doc.cables.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    mm: routes.get(c.id)?.mm ?? 0,
    bends: routes.get(c.id)?.bends ?? 0,
  }));
  return {
    sizes,
    plates: tiles.length,
    tiles: cells,
    connectors: countConnectors(tiles),
    addons,
    addonCount: addons.reduce((n, a) => n + a.qty, 0),
    bboxMm: tiles.length ? { w: footprint.w * CELL_MM, h: footprint.h * CELL_MM } : null,
    objects: doc.objects.filter((p) => p.kind === 'object').length,
    cables,
    cableMm: cables.reduce((n, c) => n + c.mm, 0),
  };
}

/** Plain-text bill of materials for the clipboard. */
export function billOfMaterialsText(bom: BillOfMaterials) {
  return [
    'Bill of materials',
    '',
    'openGrid tiles (rows×cols × qty):',
    ...bom.sizes.map((z) => `  ${z.rows}×${z.cols} × ${z.qty}`),
    `  Total: ${bom.plates} tiles, ${bom.tiles} cells`,
    `  Connectors: ${bom.connectors}`,
    '',
    'Channels and tile covers:',
    ...(bom.addons.length ? bom.addons.map((a) => `  ${a.label} (${a.spec}) × ${a.qty}`) : ['  none']),
    '',
    `Objects: ${bom.objects}`,
    `Cables: ${bom.cables.length}, ${(bom.cableMm / 1000).toFixed(2)} m total`,
    ...bom.cables.map((c) => `  ${c.name}: ${c.mm} mm`),
  ].join('\n');
}
