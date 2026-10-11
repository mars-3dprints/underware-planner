import { useEffect, useRef, useState } from 'react';
import { Canvas } from './Canvas';
import { LeftPanel, RightPanel, Swatches } from './Panels';
import { patchCable, useStore } from './store';
import { PLATE_DEFAULT, counterpart, isShaped } from './types';
import { Icon } from './icons';
import { fitToContent, canvasSize, pointer, zoomAt } from './viewUtil';

function IconBtn({ icon, label, on, danger, disabled, onClick }: { icon: Parameters<typeof Icon>[0]['name']; label: string; on?: boolean; danger?: boolean; disabled?: boolean; onClick: () => void }) {
  return <button className={'ibtn' + (on ? ' on' : '') + (danger ? ' danger' : '')} title={label} aria-label={label} aria-pressed={on} disabled={disabled} onClick={onClick}><Icon name={icon} /></button>;
}

export default function App() {
  const { tool, setTool, undo, redo, past, future, view, doc, sel, ids, cids, cableColor, setCableColor, wp, commit, peek, togglePeek } = useStore();
  const oneCable = sel?.type === 'cable' && !ids.length && cids.length < 2 ? doc.cables.find((c) => c.id === sel.id) : undefined;
  const hasSel = !!sel;
  const [colorOpen, setColorOpen] = useState(false), [showBom, setShowBom] = useState(true);
  const colorRef = useRef<HTMLSpanElement>(null), target = useRef<{ o: string[]; c: string[] } | null>(null);
  useEffect(() => { setColorOpen(false); }, [sel, ids, cids]);
  useEffect(() => {
    if (!colorOpen) return;
    const h = (e: PointerEvent) => { if (!colorRef.current?.contains(e.target as Node)) setColorOpen(false); };
    document.addEventListener('pointerdown', h); return () => document.removeEventListener('pointerdown', h);
  }, [colorOpen]);
  const canSwap = (ids.length ? doc.objects.filter((o) => ids.includes(o.id)) : sel?.type === 'obj' ? doc.objects.filter((o) => o.id === sel.id) : []).some((o) => counterpart(o.sub, o.w));
  const selObjs = doc.objects.filter((o) => (ids.length ? ids.includes(o.id) : sel?.type === 'obj' && sel.id === o.id));
  const selCables = doc.cables.filter((c) => (cids.length ? cids.includes(c.id) : sel?.type === 'cable' && sel.id === c.id));
  const selColors = [...selObjs.map((o) => o.color), ...selCables.map((c) => c.color)];
  const sameColor = selColors.length > 0 && selColors.every((c) => c === selColors[0]);
  const paint = (col: string) => {
    const t = target.current ?? { o: selObjs.map((o) => o.id), c: selCables.map((c) => c.id) }; // the parts the picker was opened for, even if the selection changed meanwhile
    const oi = new Set(t.o), ci = new Set(t.c);
    commit((d) => ({ ...d, objects: d.objects.map((o) => (oi.has(o.id) ? { ...o, color: col } : o)), cables: d.cables.map((c) => (ci.has(c.id) ? { ...c, color: col } : c)) }), 'selcol');
  };
  const canFlip = ids.length + cids.length < 2 && sel?.type === 'obj' && isShaped(doc.objects.find((o) => o.id === sel.id)?.sub);
  const fileRef = useRef<HTMLInputElement>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) return;
      const s = useStore.getState(); const m = e.metaKey || e.ctrlKey; const k = e.key.toLowerCase();
      if (m && k === 'z') { e.preventDefault(); e.shiftKey ? s.redo() : s.undo(); }
      else if (m && k === 'y') { e.preventDefault(); s.redo(); }
      else if (m && k === 'd') { e.preventDefault(); s.duplicateSel(); }
      else if (m && k === 'c') { s.copySel(); }
      else if (m && k === 'a') { e.preventDefault(); s.selectAll(); }
      else if (m && k === 'v') { e.preventDefault(); s.pasteAt(pointer.cell); }
      else if (m) return;
      else if (k === 'v') s.setTool('select');
      else if (k === 'h') s.setTool('pan');
      else if (k === 'c') s.setTool('cable');
      else if (k === 'r') (s.tool === 'place' ? s.rotateStamp(e.shiftKey) : s.rotateSel(e.shiftKey));
      else if (k.startsWith('arrow')) {
        if (s.tool === 'place' || (!s.ids.length && !s.cids.length && !s.sel)) return;
        e.preventDefault(); const n = e.shiftKey ? 5 : 1;
        s.nudgeSel(k === 'arrowleft' ? -n : k === 'arrowright' ? n : 0, k === 'arrowup' ? -n : k === 'arrowdown' ? n : 0);
      }
      else if (k === 'p') s.togglePeek();
      else if (k === 't') s.swapStyle();
      else if (k === 'f') (s.tool === 'place' ? s.flipStamp() : s.flipSel());
      else if (k === 'delete' || k === 'backspace') { e.preventDefault(); s.removeSel(); }
      else if (k === '0') fitToContent();
      else if (k === '=' || k === '+') { const { w, h } = canvasSize(); zoomAt(w / 2, h / 2, 1.25); }
      else if (k === '-') { const { w, h } = canvasSize(); zoomAt(w / 2, h / 2, 0.8); }
    };
    window.addEventListener('keydown', kd); return () => window.removeEventListener('keydown', kd);
  }, []);

  const exportJson = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, doc }, null, 2)], { type: 'application/json' }));
    a.download = 'underware-layout.json'; a.click(); URL.revokeObjectURL(a.href);
  };
  const importJson = async (f?: File) => {
    if (!f) return;
    try { const j = JSON.parse(await f.text()); if (Array.isArray(j.doc?.objects) && Array.isArray(j.doc?.cables)) { useStore.getState().load(j.doc); fitToContent(); } }
    catch { /* invalid file */ }
  };

  return (
    <div className={'app' + (showBom ? '' : ' noright')}>
      <header className="top">
        <b className="brand">Underware Planner</b>
        <div className="tools">
          <IconBtn icon="select" label="Select (V)" on={tool === 'select'} onClick={() => setTool('select')} />
          <IconBtn icon="pan" label="Pan (H)" on={tool === 'pan'} onClick={() => setTool('pan')} />
          <span className="popwrap">
            <IconBtn icon="cable" label="Cable (C)" on={tool === 'cable'} onClick={() => setTool('cable')} />
            {tool === 'cable' && (
              <div className="pop" role="dialog" aria-label="Cable colour">
                <span className="sub">Cable colour</span>
                <Swatches value={cableColor} onChange={setCableColor} />
                <p className="hint">Click a cell to start, empty cells to add points, then an object (or the last point again, or Enter) to finish. Right-click undoes a point.</p>
              </div>
            )}
          </span>
        </div>
        <i className="vsep" />
        <div className="tools">
          <IconBtn icon="undo" label="Undo (Ctrl+Z)" disabled={!past.length} onClick={undo} />
          <IconBtn icon="redo" label="Redo (Ctrl+Shift+Z)" disabled={!future.length} onClick={redo} />
        </div>
        {<>
          <i className="vsep" hidden={!hasSel} />
          <div className="tools ctx" role="toolbar" aria-label="Selection" hidden={!hasSel}>
            <span className="popwrap" ref={colorRef}>
              <button className={'ibtn' + (colorOpen ? ' on' : '')} title="Colour" aria-label="Colour" aria-expanded={colorOpen} onClick={() => { target.current = { o: selObjs.map((o) => o.id), c: selCables.map((c) => c.id) }; setColorOpen((v) => !v); }}>
                <span className="colordot" style={{ background: sameColor ? selColors[0] : 'conic-gradient(#e76f51,#e9c46a,#2a9d8f,#4361ee,#e76f51)' }} />
              </button>
              {(
                <div className="pop" role="dialog" aria-label="Colour" hidden={!colorOpen}>
                  <span className="sub">Colour{selObjs.length + selCables.length > 1 ? ` (${selObjs.length + selCables.length} items)` : ''}</span>
                  <Swatches value={sameColor ? selColors[0] : ''} extra={selObjs.some((o) => o.kind === 'plate') ? [PLATE_DEFAULT] : []} onChange={paint} />
                </div>
              )}
            </span>
            <IconBtn icon="rotate" label="Rotate (R, Shift+R reverses)" onClick={() => useStore.getState().rotateSel()} />
            {canSwap && <IconBtn icon="style" label="Switch rounded / angled (T)" onClick={() => useStore.getState().swapStyle()} />}
            {canFlip && <IconBtn icon="flip" label="Flip (F)" onClick={() => useStore.getState().flipSel()} />}
            <IconBtn icon="copy" label="Copy (Ctrl+C)" onClick={() => useStore.getState().copySel()} />
            <IconBtn icon="duplicate" label="Duplicate (Ctrl+D)" onClick={() => useStore.getState().duplicateSel()} />
            {oneCable && <>
              <IconBtn icon="delpoint" label="Delete point" disabled={wp === null} onClick={() => useStore.getState().removeSel()} />
              <IconBtn icon="reset" label="Reset route (remove all points)" disabled={!oneCable.waypoints.length} onClick={() => commit((d) => patchCable(d, oneCable.id, { waypoints: [] }))} />
            </>}
            <IconBtn icon="trash" label="Delete (Del)" danger onClick={() => useStore.getState().removeSel()} />
          </div>
        </>}
        <span className="sp" />
        <span className="zoom">{Math.round((view.k / 40) * 100)}%</span>
        <button className="btn sm" onClick={() => { const { w, h } = canvasSize(); zoomAt(w / 2, h / 2, 0.8); }}>−</button>
        <button className="btn sm" onClick={() => { const { w, h } = canvasSize(); zoomAt(w / 2, h / 2, 1.25); }}>+</button>
        <button className="btn sm" onClick={fitToContent} title="Fit (0)">Fit</button>
        <i className="vsep" />
        <IconBtn icon="peek" label="See through channels (P)" on={peek} onClick={togglePeek} />
        <IconBtn icon="sidebar" label={showBom ? 'Hide sidebar' : 'Show sidebar'} on={showBom} onClick={() => setShowBom((v) => !v)} />
        <i className="vsep" />
        <button className="btn sm" onClick={exportJson}>Export</button>
        <button className="btn sm" onClick={() => fileRef.current?.click()}>Import</button>
        <button className="btn sm danger" onClick={() => { if (armed) { useStore.getState().load({ objects: [], cables: [] }); setArmed(false); } else { setArmed(true); setTimeout(() => setArmed(false), 2500); } }}>{armed ? 'Click to confirm' : 'Clear'}</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { importJson(e.target.files?.[0]); e.target.value = ''; }} />
      </header>
      <LeftPanel />
      <main className="stage">
        <Canvas />
        <div className="legend">Scroll: pan · Ctrl/⌘+scroll or pinch: zoom · H or Space+drag: pan · drag empty canvas: select box · Shift-click: add to selection · R rotate (Shift+R other way) · Del delete · Ctrl+C/V copy/paste · double-click to rename · Esc cancel{tool === 'cable' ? ' · right-click: undo point' : tool === 'place' ? ' · right-click: stop placing' : ''}</div>
      </main>
      {showBom && <RightPanel />}
    </div>
  );
}
