import { type RefObject, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { cableRoute, partsById } from '../../domain/anchors';
import { useStore } from '../../store/store';
import { ColorDot } from '../../ui/ColorDot';

const OFFSET = 14;

/** Cable ids under a screen point, found through the invisible click targets (so it follows exact channel shapes). */
function cablesAt(x: number, y: number): string[] {
  const ids = new Set<string>();
  for (const el of document.elementsFromPoint(x, y)) {
    const id = el.getAttribute('data-k') === 'cable' ? el.getAttribute('data-id') : null;
    if (id) ids.add(id);
  }
  return [...ids];
}

/**
 * While selecting, hovering cables shows which ones are there and fades the rest. Works for any number of overlaps.
 * The tip follows the pointer, so it only shows while the pointer is over the canvas, not for list hovers.
 */
export function CableTip({ svgRef }: { svgRef: RefObject<SVGSVGElement | null> }) {
  const tipRef = useRef<HTMLDivElement>(null);
  const [onCanvas, setOnCanvas] = useState(false);
  const { ids, doc, tool } = useStore(
    useShallow((s) => ({ ids: s.hoverCableIds, doc: s.doc, tool: s.tool })),
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const { setHoverCables } = useStore.getState();
    if (tool !== 'select') {
      setHoverCables([]);
      return;
    }
    const move = (e: PointerEvent) => {
      const tip = tipRef.current;
      if (e.buttons) {
        setHoverCables([]);
        return;
      }
      setOnCanvas(true);
      setHoverCables(cablesAt(e.clientX, e.clientY));
      if (tip) {
        const flip = e.clientX + tip.offsetWidth + OFFSET > window.innerWidth;
        tip.style.left = `${flip ? e.clientX - tip.offsetWidth - OFFSET : e.clientX + OFFSET}px`;
        tip.style.top = `${e.clientY + OFFSET}px`;
      }
    };
    const leave = () => {
      setOnCanvas(false);
      setHoverCables([]);
    };
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerleave', leave);
    return () => {
      svg.removeEventListener('pointermove', move);
      svg.removeEventListener('pointerleave', leave);
      setHoverCables([]);
    };
  }, [svgRef, tool]);

  const parts = partsById(doc.objects);
  const shown = ids.map((id) => doc.cables.find((c) => c.id === id)).filter((c) => c !== undefined);
  return (
    <div
      ref={tipRef}
      className="cabtip"
      style={{ display: shown.length && onCanvas && tool === 'select' ? 'block' : 'none' }}
    >
      <b>{shown.length === 1 ? '1 cable' : `${shown.length} cables`}</b>
      {shown.map((c) => (
        <div key={c.id}>
          <ColorDot color={c.color} />
          {c.name}
          <small>{cableRoute(c, parts)}</small>
        </div>
      ))}
    </div>
  );
}
