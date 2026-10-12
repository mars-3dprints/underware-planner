import { useEffect } from 'react';
import { ZOOM_STEP } from '../domain/constants';
import { LAYERS } from '../domain/layers';
import { useStore } from '../store/store';
import { fitToContent, pointer, zoomCentered } from '../store/view';
import { isTyping } from '../ui/keyboard';

const NUDGE_FAR = 5;

/** Ctrl/⌘ shortcuts. Returns false when the key is not one. */
function commandKey(e: KeyboardEvent, key: string) {
  const s = useStore.getState();
  switch (key) {
    case 'z':
      e.preventDefault();
      if (e.shiftKey) s.redo();
      else s.undo();
      return true;
    case 'y':
      e.preventDefault();
      s.redo();
      return true;
    case 'd':
      e.preventDefault();
      s.duplicateSelection();
      return true;
    case 'c':
      s.copySelection();
      return true;
    case 'a':
      e.preventDefault();
      s.selectAll();
      return true;
    case 'v':
      e.preventDefault();
      s.pasteAt(pointer.cell);
      return true;
  }
  return false;
}

function arrowKey(e: KeyboardEvent, key: string) {
  const s = useStore.getState();
  const nothingSelected = !s.selectedIds.length && !s.selectedCableIds.length && !s.selection;
  if (s.tool === 'place' || nothingSelected) return;
  e.preventDefault();
  const n = e.shiftKey ? NUDGE_FAR : 1;
  const dx = key === 'arrowleft' ? -n : key === 'arrowright' ? n : 0;
  const dy = key === 'arrowup' ? -n : key === 'arrowdown' ? n : 0;
  s.nudgeSelection(dx, dy);
}

/** Single-key shortcuts. */
function plainKey(e: KeyboardEvent, key: string) {
  const s = useStore.getState();
  const placing = s.tool === 'place';
  if (key.startsWith('arrow')) return arrowKey(e, key);
  if (/^[1-4]$/.test(key)) return s.toggleLayer(LAYERS[+key - 1].id);
  switch (key) {
    case 'v':
      return s.setTool('select');
    case 'h':
      return s.setTool('pan');
    case 'c':
      return s.setTool('cable');
    case 'r':
      return placing ? s.rotateStamp(e.shiftKey) : s.rotateSelection(e.shiftKey);
    case 'f':
      return placing ? s.flipStamp() : s.flipSelection();
    case 't':
      return s.swapStyle();
    case 'p':
      return s.togglePeek();
    case '\\':
      return s.toggleSidebar();
    case 'delete':
    case 'backspace':
      e.preventDefault();
      return s.deleteSelection();
    case '0':
      return fitToContent();
    case '=':
    case '+':
      return zoomCentered(ZOOM_STEP);
    case '-':
      return zoomCentered(1 / ZOOM_STEP);
  }
}

/** Global keyboard shortcuts (ignored while typing in a field). */
export function useShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const key = e.key.toLowerCase();
      if (e.metaKey || e.ctrlKey) commandKey(e, key);
      else plainKey(e, key);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
