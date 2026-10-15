import { type PointerEvent, useLayoutEffect, useRef, useState } from 'react';
import { routesFor } from '../../routing/route';
import { isGroupSelected, selectedCable, selectedPart, useStore } from '../../store/store';
import { SelectionSection } from './SelectionSection';

/** What drags the card: the grab bar along its top and the title row. */
const HANDLE = '.grabbar, h3';

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/**
 * The selection's details, floating over the canvas so they show whether or not the right panel does. Drag it by
 * the bar on top or its title; double-click either to send it back to its corner. It stays where it was left between selections.
 */
export function SelectionCard() {
  const doc = useStore((s) => s.doc);
  const selected = useStore((s) => isGroupSelected(s) || !!selectedPart(s) || !!selectedCable(s));
  const offset = useStore((s) => s.selectionCardOffset);
  const setOffset = useStore((s) => s.setSelectionCardOffset);
  const card = useRef<HTMLElement>(null);
  const [dragging, setDragging] = useState(false);

  // Keeps the card inside the canvas area when its content or the area changes size, as dragging does.
  useLayoutEffect(() => {
    const el = card.current;
    if (!el) return;
    const stage = el.offsetParent!;
    const fit = () => {
      const box = el.getBoundingClientRect();
      const area = stage.getBoundingClientRect();
      const shift = (lo: number, hi: number, areaLo: number, areaHi: number) =>
        lo < areaLo ? areaLo - lo : hi > areaHi ? areaHi - hi : 0;
      const x = shift(box.left, box.right, area.left, area.right);
      const y = shift(box.top, box.bottom, area.top, area.bottom);
      if (!x && !y) return;
      const { selectionCardOffset: now } = useStore.getState();
      setOffset({ x: now.x + x, y: now.y + y });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [selected, setOffset]);

  if (!selected) return null;

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !(e.target as Element).closest(HANDLE)) return;
    const el = card.current!;
    const stage = el.offsetParent!.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, offset };
    const startBox = el.getBoundingClientRect();
    setDragging(true);
    const move = (ev: globalThis.PointerEvent) => {
      // Keep the whole card inside the canvas area.
      setOffset({
        x:
          start.offset.x +
          clamp(ev.clientX - start.x, stage.left - startBox.left, stage.right - startBox.right),
        y:
          start.offset.y +
          clamp(ev.clientY - start.y, stage.top - startBox.top, stage.bottom - startBox.bottom),
      });
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      setDragging(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  return (
    <aside
      ref={card}
      className={'panel selcard' + (dragging ? ' dragging' : '')}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => (e.target as Element).closest(HANDLE) && setOffset({ x: 0, y: 0 })}
    >
      <div className="grabbar" aria-hidden="true" />
      <SelectionSection routes={routesFor(doc)} />
    </aside>
  );
}
