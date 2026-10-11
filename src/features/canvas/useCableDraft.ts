import { useCallback, useMemo, useState } from 'react';
import { anchorAt, anchorCell, deviceAt, partsById, sameCell } from '../../domain/anchors';
import type { Anchor, Cell } from '../../domain/types';
import { cableObstacles, routeThrough, simplify } from '../../routing/route';
import { useStore } from '../../store/store';

/** A cable being drawn with the cable tool: its start and the points clicked so far. */
interface CableDraft {
  a: Anchor;
  waypoints: Cell[];
}

export function useCableDraft(hover: Cell | null) {
  const doc = useStore((s) => s.doc);
  const devicesHidden = useStore((s) => s.hidden.objects);
  const [draft, setDraft] = useState<CableDraft | null>(null);
  const cancel = useCallback(() => setDraft(null), []);

  /** Adds the cable ending at `end`, unless it would have no length. */
  const finish = (end: Anchor, waypoints: Cell[]) => {
    if (!draft) return;
    const byId = partsById(useStore.getState().doc.objects);
    const start = anchorCell(draft.a, byId);
    const stop = anchorCell(end, byId);
    if (!start || !stop || (!waypoints.length && sameCell(start, stop))) return;
    useStore.getState().addCable(draft.a, end, waypoints);
    setDraft(null);
  };

  /** Finishes at the cell under the pointer (Enter). */
  const finishAtHover = () => {
    if (!draft || !hover) return;
    const s = useStore.getState();
    finish(anchorAt(s.doc, hover, s.hidden.objects), draft.waypoints);
  };

  /**
   * First click starts the cable; clicking an object finishes it; clicking an empty cell adds a point, and
   * clicking the last point again stops the cable there.
   */
  const click = (cell: Cell) => {
    const s = useStore.getState();
    const hiddenDevices = s.hidden.objects;
    if (!draft) {
      setDraft({ a: anchorAt(s.doc, cell, hiddenDevices), waypoints: [] });
      return;
    }
    if (deviceAt(s.doc, cell, hiddenDevices)) {
      finish(anchorAt(s.doc, cell, hiddenDevices), draft.waypoints);
      return;
    }
    const last = draft.waypoints[draft.waypoints.length - 1] ?? anchorCell(draft.a, partsById(s.doc.objects));
    if (sameCell(last, cell)) {
      if (draft.waypoints.length) finish({ x: cell.x, y: cell.y }, draft.waypoints.slice(0, -1));
      return;
    }
    setDraft({ ...draft, waypoints: [...draft.waypoints, cell] });
  };

  /** Removes the last point, or cancels the cable when there is none. */
  const undoPoint = () =>
    setDraft(draft && draft.waypoints.length ? { ...draft, waypoints: draft.waypoints.slice(0, -1) } : null);

  /** Corners of the route from the start, through the points, to the hovered cell. */
  const preview = useMemo(() => {
    if (!draft || !hover) return null;
    const start = anchorCell(draft.a, partsById(doc.objects));
    if (!start) return null;
    const obstacles = cableObstacles(doc.objects, draft.a.objId, deviceAt(doc, hover, devicesHidden)?.id);
    return simplify(routeThrough([start, ...draft.waypoints, hover], obstacles).cells);
  }, [draft, hover, doc, devicesHidden]);

  return { draft, cancel, finishAtHover, click, undoPoint, preview };
}

export type CableDraftApi = ReturnType<typeof useCableDraft>;
