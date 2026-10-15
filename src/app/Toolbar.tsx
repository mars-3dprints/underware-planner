import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { BASE_ZOOM, ZOOM_STEP } from '../domain/constants';
import { emptyDoc } from '../domain/doc';
import { activeFileName, useStore } from '../store/store';
import { fitToContent, zoomCentered } from '../store/view';
import { IconButton } from '../ui/IconButton';
import { Swatches } from '../ui/Swatches';
import { exportLayout, importLayout } from './fileTransfer';
import { LayersMenu } from './LayersMenu';
import { SelectionTools } from './SelectionTools';
import { VersionMenu } from './VersionMenu';

const CONFIRM_MS = 2500;

function ToolButtons() {
  const { tool, setTool, cableColor, setCableColor } = useStore(
    useShallow((s) => ({
      tool: s.tool,
      setTool: s.setTool,
      cableColor: s.cableColor,
      setCableColor: s.setCableColor,
    })),
  );
  return (
    <div className="tools">
      <IconButton icon="select" label="Select (V)" on={tool === 'select'} onClick={() => setTool('select')} />
      <IconButton icon="pan" label="Pan (H)" on={tool === 'pan'} onClick={() => setTool('pan')} />
      <span className="popwrap">
        <IconButton icon="cable" label="Cable (C)" on={tool === 'cable'} onClick={() => setTool('cable')} />
        {tool === 'cable' && (
          <div className="pop" role="dialog" aria-label="Cable colour">
            <span className="sub">Cable colour</span>
            <Swatches value={cableColor} onChange={setCableColor} />
            <p className="hint">
              Click a cell to start, empty cells to add points, then an object (or the last point again, or
              Enter) to finish. Right-click undoes a point.
            </p>
          </div>
        )}
      </span>
    </div>
  );
}

function ZoomControls() {
  const zoom = useStore((s) => s.view.k);
  return (
    <>
      <span className="zoom">{Math.round((zoom / BASE_ZOOM) * 100)}%</span>
      <button className="btn sm" onClick={() => zoomCentered(1 / ZOOM_STEP)}>
        −
      </button>
      <button className="btn sm" onClick={() => zoomCentered(ZOOM_STEP)}>
        +
      </button>
      <button className="btn sm" onClick={fitToContent} title="Fit (0)">
        Fit
      </button>
    </>
  );
}

/** Export, import, and Clear (which asks for a second click). */
function FileButtons() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);
  const clear = () => {
    if (confirming) {
      useStore.getState().replaceDoc(emptyDoc());
      setConfirming(false);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), CONFIRM_MS);
    }
  };
  return (
    <>
      <button
        className="btn sm"
        onClick={() => {
          const s = useStore.getState();
          exportLayout(s.doc, activeFileName(s) || 'underware-layout');
        }}
      >
        Export
      </button>
      <button className="btn sm" onClick={() => fileRef.current?.click()}>
        Import
      </button>
      <button className="btn sm danger" onClick={clear}>
        {confirming ? 'Click to confirm' : 'Clear'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          importLayout(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </>
  );
}

export function Toolbar() {
  const { undo, redo, canUndo, canRedo, peek, togglePeek, sidebarOpen, toggleSidebar } = useStore(
    useShallow((s) => ({
      undo: s.undo,
      redo: s.redo,
      canUndo: s.past.length > 0,
      canRedo: s.future.length > 0,
      peek: s.peek,
      togglePeek: s.togglePeek,
      sidebarOpen: s.sidebarOpen,
      toggleSidebar: s.toggleSidebar,
    })),
  );
  return (
    <header className="top">
      <div className="brandwrap">
        <b className="brand">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" width={22} height={22} />
          <span className="brandname">Underware Planner</span>
        </b>
        <VersionMenu />
      </div>
      <ToolButtons />
      <i className="vsep" />
      <div className="tools">
        <IconButton icon="undo" label="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo} />
        <IconButton icon="redo" label="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo} />
      </div>
      <SelectionTools />
      <span className="sp" />
      <ZoomControls />
      <i className="vsep" />
      <LayersMenu />
      <IconButton icon="peek" label="See through channels (P)" on={peek} onClick={togglePeek} />
      <IconButton
        icon="sidebar"
        label={`${sidebarOpen ? 'Hide' : 'Show'} sidebar (\\)`}
        on={sidebarOpen}
        onClick={toggleSidebar}
      />
      <i className="vsep" />
      <FileButtons />
    </header>
  );
}
