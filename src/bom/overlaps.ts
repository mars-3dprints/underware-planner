import { channelGeometry } from '../domain/geometry';
import { isVertical } from '../domain/pieces';
import type { Doc, Part } from '../domain/types';

/** Samples per cell side when testing which cells a channel shape really covers. */
const SAMPLES = 5;
const CACHE_LIMIT = 600;

let context: CanvasRenderingContext2D | null | undefined;
const cache = new Map<string, Map<string, boolean>>();

/**
 * Sample points a channel's shape covers, so curved pieces that only share a bounding box do not count as
 * overlapping. The value is true where a bridge passes over the ground. Empty outside a browser.
 */
function coveredSamples(part: Part) {
  const key = [part.sub, part.x, part.y, part.w, part.h, part.rot ?? 0, part.flip ? 1 : 0].join();
  const cached = cache.get(key);
  if (cached) return cached;
  const out = new Map<string, boolean>();
  if (context === undefined) {
    context = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  }
  if (context) {
    const S = SAMPLES;
    const { d, m } = channelGeometry(part);
    const path = new Path2D(d);
    const length = Math.max(part.w, part.h);
    if (m) context.setTransform(S * m[0], S * m[1], S * m[2], S * m[3], S * m[4], S * m[5]);
    else context.setTransform(S, 0, 0, S, 0, 0);
    for (let j = 0; j < part.h * S; j++) {
      for (let i = 0; i < part.w * S; i++) {
        const X = part.x * S + i;
        const Y = part.y * S + j;
        if (!context.isPointInPath(path, X + 0.37, Y + 0.61)) continue;
        const cellAlong = Math.floor((isVertical(part) ? j : i) / S);
        out.set(`${X},${Y}`, part.sub === 'bridge' && cellAlong > 0 && cellAlong < length - 1);
      }
    }
  }
  if (cache.size > CACHE_LIMIT) cache.clear();
  cache.set(key, out);
  return out;
}

const boxesOverlap = (a: Part, b: Part) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Channels overlap when they share at least 3 samples, ignoring where a bridge passes over the other. */
function channelsOverlap(a: Part, b: Part) {
  const samplesA = coveredSamples(a);
  const samplesB = coveredSamples(b);
  let shared = 0;
  for (const [key, aOver] of samplesA) {
    if (!samplesB.has(key)) continue;
    const bOver = samplesB.get(key)!;
    const bridged = (aOver && b.sub !== 'bridge') || (bOver && a.sub !== 'bridge');
    if (!bridged) shared++;
  }
  return shared >= 3;
}

/** Ids of parts that overlap another part of the same kind. */
export function findOverlaps(doc: Doc): Set<string> {
  const overlapping = new Set<string>();
  const parts = doc.objects;
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i];
      const b = parts[j];
      if (a.kind !== b.kind || !boxesOverlap(a, b)) continue;
      if (a.kind === 'raceway' && !channelsOverlap(a, b)) continue;
      overlapping.add(a.id);
      overlapping.add(b.id);
    }
  }
  return overlapping;
}

const overlapCache = new WeakMap<Doc, Set<string>>();

/** `findOverlaps`, computed once per layout. */
export function overlapsFor(doc: Doc): Set<string> {
  let overlaps = overlapCache.get(doc);
  if (!overlaps) {
    overlaps = findOverlaps(doc);
    overlapCache.set(doc, overlaps);
  }
  return overlaps;
}
