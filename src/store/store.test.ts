// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Doc } from '../domain/types';
import { fixture } from '../test/fixture';
import { STORAGE_KEY } from './persistence';

async function freshStore(saved?: unknown) {
  localStorage.clear();
  if (saved !== undefined) localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  vi.resetModules();
  return import('./store');
}

describe('persistence', () => {
  it('seeds a sample layout when nothing is saved', async () => {
    const { useStore } = await freshStore();
    const s = useStore.getState();
    expect(s.doc.objects.length).toBeGreaterThan(0);
    expect(s.viewRestored).toBe(false);
  });

  it('migrates older saves', async () => {
    const legacy: Doc = {
      objects: [
        { id: 'a', kind: 'plate', name: 'Plate', x: 0, y: 0, w: 2, h: 2, color: '#fff' },
        { id: 'c', kind: 'raceway', name: 'x', sub: 'turn2' as never, x: 0, y: 0, w: 1, h: 1, color: '#000' },
        {
          id: 'd',
          kind: 'raceway',
          name: 'Channel, branch (rounded)',
          sub: 'branch_round' as never,
          x: 0,
          y: 0,
          w: 2,
          h: 3,
          color: '#000',
          rot: 1,
        },
        {
          id: 'e',
          kind: 'raceway',
          name: 'x',
          sub: 'jog_angled_s' as never,
          x: 0,
          y: 0,
          w: 2,
          h: 3,
          color: '#000',
        },
        { id: 'f', kind: 'raceway', name: 'x', sub: 't', x: 0, y: 0, w: 1, h: 1, color: '#000' },
        { id: 'g', kind: 'raceway', name: 'x', sub: 'turn', x: 0, y: 0, w: 2, h: 4, color: '#000' },
      ],
      cables: [],
    };
    const { useStore } = await freshStore({
      doc: legacy,
      view: { x: 1, y: 2, k: 30 },
      palette: ['#e76f51', '#abcdef'],
    });
    const s = useStore.getState();
    expect(s.doc.objects).toMatchSnapshot();
    expect(s.view).toEqual({ x: 1, y: 2, k: 30 });
    expect(s.viewRestored).toBe(true);
    expect(s.palette).toEqual(['#abcdef']);
  });

  it('autosaves doc, view and palette', async () => {
    vi.useFakeTimers();
    const { useStore } = await freshStore({ doc: fixture(), view: null, palette: [] });
    useStore.getState().commit((d) => ({ ...d, cables: [] }));
    vi.advanceTimersByTime(400);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).files[0].doc.cables).toEqual([]);
    vi.useRealTimers();
  });
});

describe('files', () => {
  it('saves and restores several files', async () => {
    vi.useFakeTimers();
    const { useStore } = await freshStore({ doc: fixture(), view: null, palette: [] });
    const s = () => useStore.getState();
    s().addFile();
    s().commit((d) => ({ ...d, objects: fixture().objects.slice(0, 1) }));
    vi.advanceTimersByTime(400);
    vi.useRealTimers();
    const again = (await freshStore(JSON.parse(localStorage.getItem(STORAGE_KEY)!))).useStore.getState();
    expect(again.files.map((f) => f.name)).toEqual(['File 1', 'File 2']);
    expect(again.activeFileId).toBe(s().activeFileId);
    expect(again.doc.objects).toHaveLength(1);
    expect(again.parked[again.files[0].id].doc).toEqual(fixture());
  });

  it('keeps each file its own layout and undo history', async () => {
    const { useStore } = await freshStore({ doc: fixture(), view: null, palette: [] });
    const s = () => useStore.getState();
    const first = s().activeFileId;
    s().commit((d) => ({ ...d, cables: [] }));
    s().addFile();
    expect(s().doc).toEqual({ objects: [], cables: [] });
    expect(s().past).toEqual([]);
    s().switchFile(first);
    expect(s().doc.cables).toEqual([]);
    expect(s().past).toHaveLength(1);
    s().undo();
    expect(s().doc).toEqual(fixture());
  });

  it('names new files after the lowest free number, and clears the selection on switch', async () => {
    const { useStore } = await freshStore({ doc: fixture(), view: null, palette: [] });
    const s = () => useStore.getState();
    s().addFile();
    s().addFile();
    s().deleteFile(s().files[1].id);
    s().addFile();
    expect(s().files.map((f) => f.name)).toEqual(['File 1', 'File 3', 'File 2']);
    s().select({ type: 'obj', id: 'o1' });
    s().switchFile(s().files[0].id);
    expect(s().selection).toBeNull();
  });

  it('closes files, opening the neighbour, but never the last one', async () => {
    const { useStore } = await freshStore({ doc: fixture(), view: null, palette: [] });
    const s = () => useStore.getState();
    const [first] = s().files;
    s().addFile();
    const second = s().activeFileId;
    s().deleteFile(second);
    expect(s().activeFileId).toBe(first.id);
    expect(s().parked).toEqual({});
    s().deleteFile(first.id);
    expect(s().files).toHaveLength(1);
  });

  it('closes the other files, or resets the whole workspace', async () => {
    const { useStore } = await freshStore({ doc: fixture(), view: null, palette: [] });
    const s = () => useStore.getState();
    const first = s().activeFileId;
    s().addFile();
    s().addFile();
    s().closeOtherFiles(first);
    expect(s().files.map((f) => f.id)).toEqual([first]);
    expect(s().activeFileId).toBe(first);
    expect(s().parked).toEqual({});
    expect(s().doc).toEqual(fixture());
    s().addFile();
    s().addColor('#abcdef');
    s().setTool('pan');
    s().setCableColor('#abcdef');
    s().toggleLayer('cables');
    s().togglePeek();
    s().copySelection();
    const epoch = s().epoch;
    s().resetWorkspace();
    expect(s().epoch).toBe(epoch + 1);
    expect(s().palette).toEqual([]);
    expect(s().tool).toBe('select');
    expect(s().cableColor).not.toBe('#abcdef');
    expect(s().hidden.cables).toBe(false);
    expect(s().peek).toBe(false);
    expect(s().clipboard).toBeNull();
    expect(s().files.map((f) => f.name)).toEqual(['File 1']);
    expect(s().doc).toEqual({ objects: [], cables: [] });
    expect(s().past).toEqual([]);
    expect(s().parked).toEqual({});
  });

  it('renames a file, ignoring blank names', async () => {
    const { useStore } = await freshStore();
    const s = () => useStore.getState();
    s().renameFile(s().activeFileId, '  Desk  ');
    s().renameFile(s().activeFileId, ' ');
    expect(s().files[0].name).toBe('Desk');
  });
});

describe('store actions', () => {
  let store: Awaited<ReturnType<typeof freshStore>>['useStore'];
  const s = () => store.getState();
  beforeEach(async () => {
    store = (await freshStore({ doc: fixture(), view: null, palette: [] })).useStore;
  });

  it('commits with history and coalesces keyed edits', () => {
    s().commit((d) => ({ ...d, cables: [] }));
    s().commit((d) => d);
    expect(s().past).toHaveLength(1);
    s().commit((d) => ({ ...d, objects: d.objects.slice(1) }), 'k');
    s().commit((d) => ({ ...d, objects: d.objects.slice(1) }), 'k');
    expect(s().past).toHaveLength(2);
    s().undo();
    expect(s().doc.objects).toHaveLength(fixture().objects.length);
    expect(s().selectedIds).toEqual(['p1', 'p2']);
    s().redo();
    expect(s().doc.objects).toHaveLength(fixture().objects.length - 2);
  });

  it('records live drags as one history entry', () => {
    s().beginLive();
    s().live((d) => ({ ...d, cables: [] }));
    s().live((d) => ({ ...d, objects: [] }));
    s().endLive();
    expect(s().past).toHaveLength(1);
    s().undo();
    expect(s().doc).toEqual(fixture());
  });

  it('adds cables and cycles the cable colour', () => {
    s().selectItems(['o1', 'o2'], ['k1']);
    s().addCable({ x: 0, y: 30 }, { x: 5, y: 30 }, []);
    expect(s().doc.cables.at(-1)).toMatchObject({
      name: `Cable ${fixture().cables.length + 1}`,
      color: '#e76f51',
    });
    expect(s().cableColor).toBe('#f4a261');
    expect(s().selection).toEqual({ type: 'cable', id: s().doc.cables.at(-1)!.id });
    // The new cable replaces the selection, so colour and delete act on it alone.
    expect(s().selectedIds).toEqual([]);
    expect(s().selectedCableIds).toEqual([s().doc.cables.at(-1)!.id]);
  });

  it('deletes a selected waypoint, then the selection', () => {
    s().select({ type: 'cable', id: 'k6' });
    s().setActiveWaypoint(0);
    s().deleteSelection();
    expect(s().doc.cables.find((c) => c.id === 'k6')!.waypoints).toEqual([{ x: 9, y: 17 }]);
    s().selectItems(['o1'], ['k6']);
    s().deleteSelection();
    expect(s().doc.cables.some((c) => c.id === 'k6')).toBe(false);
    expect(s().doc.objects.some((o) => o.id === 'o1')).toBe(false);
    expect(s().selection).toBeNull();
  });

  it('duplicates, copies and pastes with internal cables', () => {
    s().selectItems(['o1', 'o2']);
    s().duplicateSelection();
    expect(s().selectedIds).toHaveLength(2);
    expect(s().selectedCableIds).toHaveLength(1);
    expect(s().doc.objects.find((o) => o.id === s().selectedIds[0])).toMatchObject({
      name: 'Router',
      x: 2,
      y: 2,
    });
    s().selectItems(['o3']);
    s().copySelection();
    s().pasteAt({ x: 30, y: 30 });
    s().pasteAt({ x: 30, y: 30 });
    expect(s().doc.objects.find((o) => o.id === s().selectedIds[0])).toMatchObject({
      name: 'NAS',
      x: 31,
      y: 31,
    });
  });

  it('adds no undo step when flipping a part that cannot be flipped', () => {
    s().select({ type: 'obj', id: 'o1' });
    s().flipSelection();
    s().select({ type: 'obj', id: 's1' });
    s().flipSelection();
    expect(s().past).toHaveLength(0);
  });

  it('rotates, flips, swaps style and nudges the selection', () => {
    s().select({ type: 'obj', id: 'y1' });
    s().flipSelection();
    expect(s().doc.objects.find((o) => o.id === 'y1')!.flip).toBe(true);
    s().swapStyle();
    expect(s().doc.objects.find((o) => o.id === 'y1')).toMatchObject({
      sub: 'y_angled',
      name: 'Channel, merge/branch (angled)',
    });
    s().rotateSelection();
    expect(s().doc.objects.find((o) => o.id === 'y1')).toMatchObject({ rot: 1, w: 3, h: 2 });
    s().rotateSelection(true);
    expect(s().doc.objects.find((o) => o.id === 'y1')).toMatchObject({ rot: 0, w: 2, h: 3 });
    s().nudgeSelection(1, 0);
    s().nudgeSelection(1, 0);
    expect(s().doc.objects.find((o) => o.id === 'y1')).toMatchObject({ x: 2 });
    const before = s().past.length;
    s().undo();
    expect(s().doc.objects.find((o) => o.id === 'y1')).toMatchObject({ x: 0 });
    expect(s().past.length).toBe(before - 1);
  });

  it('includes the selected parts in, or leaves them out of, the bill of materials', async () => {
    const { selectionInBom } = await import('./store');
    s().selectItems([], ['k1']);
    expect(selectionInBom(s())).toBeUndefined();
    s().select({ type: 'obj', id: 'o1' });
    expect(selectionInBom(s())).toBeUndefined();
    s().select({ type: 'obj', id: 'p1' });
    expect(selectionInBom(s())).toBe(true);
    s().setSelectionInBom(false);
    expect(selectionInBom(s())).toBe(false);
    s().selectItems(['p1', 'p2']);
    expect(selectionInBom(s())).toBe('mixed');
    s().setSelectionInBom(true);
    expect(s().doc.objects.some((p) => p.noBom)).toBe(false);
    expect(s().past).toHaveLength(2);
  });

  it('reorders cables as one undoable step', () => {
    s().moveCable('k6', 0);
    expect(s().doc.cables[0].id).toBe('k6');
    expect(s().past).toHaveLength(1);
    s().undo();
    expect(s().doc.cables.map((c) => c.id)).toEqual(fixture().cables.map((c) => c.id));
    expect(s().selectedCableIds).toEqual(['k6']);
    s().redo();
    expect(s().selectedCableIds).toEqual(['k6']);
  });

  it('places stamps and blocks', () => {
    s().toggleLayer('channels');
    s().setStamp('turn', 3);
    expect(s()).toMatchObject({
      tool: 'place',
      hidden: { channels: false },
      stamp: { sub: 'turn', len: 3, rot: 0 },
    });
    s().rotateStamp(true);
    s().flipStamp();
    s().swapStyle();
    s().resizeStamp(5);
    // A sideways piece also turns half way when flipped (see `flipped`).
    expect(s().stamp).toMatchObject({ sub: 'angled', len: 5, rot: 1, flip: true });
    s().setPieceColor('#123456');
    expect(s().stamp!.color).toBe('#123456');
    s().setBlock({ kind: 'plate', name: 'Tile', w: 4, h: 2, color: '#fff' });
    s().rotateStamp();
    s().patchBlock('plate', { w: 6 });
    expect(s().block).toMatchObject({ w: 2, h: 6, swapped: true });
    s().setTool('select');
    expect(s().block).toBeNull();
  });

  it('drops hidden layers from the selection', () => {
    s().selectItems(['o1', 's1'], ['k1']);
    s().toggleLayer('objects');
    expect(s().selectedIds).toEqual(['s1']);
    s().toggleLayer('cables');
    expect(s().selectedCableIds).toEqual([]);
    s().selectAll();
    expect(s().selectedIds.includes('o1')).toBe(false);
    s().setTool('cable');
    expect(s().hidden.cables).toBe(false);
    s().showLayers('objects');
    expect(s().hidden.objects).toBe(false);
  });

  it('manages the custom palette', () => {
    s().addColor('#ABCDEF');
    s().addColor('#abcdef');
    s().addColor('#e76f51');
    expect(s().palette).toEqual(['#abcdef']);
    s().removeColor('#abcdef');
    expect(s().palette).toEqual([]);
  });

  it('loads a layout as one undoable step', () => {
    s().select({ type: 'obj', id: 'o1' });
    s().replaceDoc({ objects: [], cables: [] });
    expect(s().doc.objects).toEqual([]);
    expect(s().selection).toBeNull();
    s().undo();
    expect(s().doc).toEqual(fixture());
  });
});
