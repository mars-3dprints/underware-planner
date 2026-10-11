import { BASE_ZOOM } from '../domain/constants';
import { boundsOf } from '../domain/group';
import type { Cell } from '../domain/types';
import { useStore } from './store';

const MIN_ZOOM = 4;
const MAX_ZOOM = 160;
const MAX_FIT_ZOOM = 80;
const FIT_PADDING = 60;

function canvasSize() {
  const rect = document.querySelector('.canvas')?.getBoundingClientRect();
  return { w: rect?.width ?? 800, h: rect?.height ?? 600 };
}

/** Frames the whole layout, or centres an empty canvas. */
export function fitToContent() {
  const { doc, setView } = useStore.getState();
  const { w, h } = canvasSize();
  if (!doc.objects.length) {
    setView({ x: w / 2, y: h / 2, k: BASE_ZOOM });
    return;
  }
  const box = boundsOf(doc.objects);
  const fit = Math.min((w - FIT_PADDING * 2) / box.w, (h - FIT_PADDING * 2) / box.h);
  const k = Math.max(MIN_ZOOM, Math.min(MAX_FIT_ZOOM, fit));
  setView({ k, x: w / 2 - (box.x + box.w / 2) * k, y: h / 2 - (box.y + box.h / 2) * k });
}

/** Zooms by `factor`, keeping the screen point (px, py) fixed. */
export function zoomAt(px: number, py: number, factor: number) {
  const { view, setView } = useStore.getState();
  const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.k * factor));
  const r = k / view.k;
  setView({ k, x: px - (px - view.x) * r, y: py - (py - view.y) * r });
}

/** Zooms by `factor` about the middle of the canvas. */
export function zoomCentered(factor: number) {
  const { w, h } = canvasSize();
  zoomAt(w / 2, h / 2, factor);
}

/** Last cell under the pointer on the canvas (where Ctrl+V pastes), or null when the pointer is elsewhere. */
export const pointer: { cell: Cell | null } = { cell: null };
