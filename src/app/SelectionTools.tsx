import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { TILE_COLOR } from '../domain/constants';
import { patchCable } from '../domain/doc';
import type { Cable, Part } from '../domain/types';
import { canFlip, canSwapStyle, pointEditableCable, targets, useStore } from '../store/store';
import { IconButton } from '../ui/IconButton';
import { Swatches } from '../ui/Swatches';
import { useDismiss } from '../ui/useDismiss';

const MIXED_COLORS = 'conic-gradient(#e76f51,#e9c46a,#2a9d8f,#4361ee,#e76f51)';

/** Colour button and swatches for the selection. */
function SelectionColor() {
  const { doc, selection, selectedIds, selectedCableIds, commit } = useStore(
    useShallow((s) => ({
      doc: s.doc,
      selection: s.selection,
      selectedIds: s.selectedIds,
      selectedCableIds: s.selectedCableIds,
      commit: s.commit,
    })),
  );
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  /** The items the picker was opened for, even if the selection changes meanwhile. */
  const target = useRef<{ parts: Part[]; cables: Cable[] } | null>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  useEffect(close, [selection, selectedIds, selectedCableIds, close]);

  const { partIds, cableIds } = targets({ doc, selection, selectedIds, selectedCableIds });
  const parts = doc.objects.filter((p) => partIds.includes(p.id));
  const cables = doc.cables.filter((c) => cableIds.includes(c.id));
  const colors = [...parts.map((p) => p.color), ...cables.map((c) => c.color)];
  const shared = colors.length > 0 && colors.every((c) => c === colors[0]) ? colors[0] : '';
  const count = parts.length + cables.length;

  const paint = (color: string) => {
    const painted = target.current ?? { parts, cables };
    const partSet = new Set(painted.parts.map((p) => p.id));
    const cableSet = new Set(painted.cables.map((c) => c.id));
    commit(
      (d) => ({
        ...d,
        objects: d.objects.map((p) => (partSet.has(p.id) ? { ...p, color } : p)),
        cables: d.cables.map((c) => (cableSet.has(c.id) ? { ...c, color } : c)),
      }),
      'selcol',
    );
  };

  return (
    <span className="popwrap" ref={ref}>
      <button
        className={'ibtn' + (open ? ' on' : '')}
        title="Colour"
        aria-label="Colour"
        aria-expanded={open}
        onClick={() => {
          target.current = { parts, cables };
          setOpen((v) => !v);
        }}
      >
        <span className="colordot" style={{ background: shared || MIXED_COLORS }} />
      </button>
      <div className="pop" role="dialog" aria-label="Colour" hidden={!open}>
        <span className="sub">Colour{count > 1 ? ` (${count} items)` : ''}</span>
        <Swatches
          value={shared}
          extra={parts.some((p) => p.kind === 'plate') ? [TILE_COLOR] : []}
          onChange={paint}
        />
      </div>
    </span>
  );
}

/** Context toolbar for the selection; hidden when nothing is selected. */
export function SelectionTools() {
  const { hasSelection, cable, swappable, flippable, activeWaypoint } = useStore(
    useShallow((s) => ({
      hasSelection: !!s.selection,
      cable: pointEditableCable(s),
      swappable: canSwapStyle(s),
      flippable: canFlip(s),
      activeWaypoint: s.activeWaypoint,
    })),
  );
  const s = useStore.getState;
  return (
    <>
      <i className="vsep" hidden={!hasSelection} />
      <div className="tools ctx" role="toolbar" aria-label="Selection" hidden={!hasSelection}>
        <SelectionColor />
        <IconButton
          icon="rotate"
          label="Rotate (R, Shift+R reverses)"
          onClick={() => s().rotateSelection()}
        />
        {swappable && (
          <IconButton icon="style" label="Switch rounded / angled (T)" onClick={() => s().swapStyle()} />
        )}
        {flippable && <IconButton icon="flip" label="Flip (F)" onClick={() => s().flipSelection()} />}
        <IconButton icon="copy" label="Copy (Ctrl+C)" onClick={() => s().copySelection()} />
        <IconButton icon="duplicate" label="Duplicate (Ctrl+D)" onClick={() => s().duplicateSelection()} />
        {cable && (
          <>
            <IconButton
              icon="delpoint"
              label="Delete point"
              disabled={activeWaypoint === null}
              onClick={() => s().deleteSelection()}
            />
            <IconButton
              icon="reset"
              label="Reset route (remove all points)"
              disabled={!cable.waypoints.length}
              onClick={() => s().commit((d) => patchCable(d, cable.id, { waypoints: [] }))}
            />
          </>
        )}
        <IconButton icon="trash" label="Delete (Del)" danger onClick={() => s().deleteSelection()} />
      </div>
    </>
  );
}
