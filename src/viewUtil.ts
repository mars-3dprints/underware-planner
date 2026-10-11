import { useStore } from './store';
import type { Cell } from './types';

export function canvasSize() {
  const r = document.querySelector('.canvas')?.getBoundingClientRect();
  return { w: r?.width ?? 800, h: r?.height ?? 600 };
}
export function viewCenterCell(): Cell {
  const { w, h } = canvasSize();
  const v = useStore.getState().view;
  return { x: Math.floor((w / 2 - v.x) / v.k), y: Math.floor((h / 2 - v.y) / v.k) };
}
export function fitToContent() {
  const { doc, setView } = useStore.getState();
  const { w, h } = canvasSize();
  if (!doc.objects.length) {
    setView({ x: w / 2, y: h / 2, k: 40 });
    return;
  }
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const o of doc.objects) {
    x0 = Math.min(x0, o.x);
    y0 = Math.min(y0, o.y);
    x1 = Math.max(x1, o.x + o.w);
    y1 = Math.max(y1, o.y + o.h);
  }
  const pad = 60,
    k = Math.max(4, Math.min(80, Math.min((w - pad * 2) / (x1 - x0), (h - pad * 2) / (y1 - y0))));
  setView({ k, x: w / 2 - ((x0 + x1) / 2) * k, y: h / 2 - ((y0 + y1) / 2) * k });
}
export function zoomAt(px: number, py: number, f: number) {
  const { view: v, setView } = useStore.getState();
  const k = Math.max(4, Math.min(160, v.k * f)),
    r = k / v.k;
  setView({ k, x: px - (px - v.x) * r, y: py - (py - v.y) * r });
}

/** Last pointer cell over the canvas (used for paste). */
export const pointer: { cell: Cell | null } = { cell: null };
