import { type RefObject, useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { zoomAt } from '../../store/view';
import { isTyping } from '../../ui/keyboard';

/** Wheel pans the canvas; Ctrl/⌘ + wheel (and trackpad pinch) zooms about the pointer. */
export function useWheelPanZoom(svgRef: RefObject<SVGSVGElement | null>) {
  useEffect(() => {
    const svg = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { view, setView } = useStore.getState();
      const rect = svg.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const delta = Math.max(-40, Math.min(40, e.deltaY));
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-delta * 0.01));
      } else {
        setView({ ...view, x: view.x - e.deltaX, y: view.y - e.deltaY });
      }
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [svgRef]);
}

interface CanvasKeyHandlers {
  /** Esc: drop any cable being drawn. */
  onCancel: () => void;
  /** Enter: finish the cable being drawn. */
  onFinish: () => void;
}

/** Canvas keys: Space held (pan), Esc and Enter. Returns whether Space is held. */
export function useCanvasKeys(handlers: CanvasKeyHandlers) {
  const [spaceHeld, setSpaceHeld] = useState(false);
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (e.code === 'Space') {
        setSpaceHeld(true);
        e.preventDefault();
      }
      if (e.key === 'Escape') {
        latest.current.onCancel();
        const s = useStore.getState();
        if (s.tool === 'select') s.select(null);
        else s.setTool('select');
      }
      if (e.key === 'Enter') latest.current.onFinish();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  return spaceHeld;
}
