import { Canvas } from '../features/canvas/Canvas';
import { InspectorPanel } from '../features/panels/InspectorPanel';
import { LibraryPanel } from '../features/panels/LibraryPanel';
import type { Tool } from '../domain/types';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store/store';
import { FileTabs } from './FileTabs';
import { placingStatus } from './placing';
import { Toolbar } from './Toolbar';
import { useShortcuts } from './useShortcuts';

const LEGEND =
  'Scroll: pan · Ctrl/⌘+scroll or pinch: zoom · H or Space+drag: pan · drag empty canvas: select box · ' +
  'Shift-click: add to selection · R rotate (Shift+R other way) · Del delete · Ctrl+C/V copy/paste · ' +
  'double-click to rename · Esc cancel';

const TOOL_HINTS: Partial<Record<Tool, string>> = {
  cable: ' · right-click: undo point',
  place: ' · right-click: stop placing',
};

/** Keys and mouse hints, led by what is being placed while placing. */
function Legend() {
  const tool = useStore((s) => s.tool);
  const placing = useStore(useShallow(placingStatus));
  return (
    <div className="legend">
      {placing && (
        <div>
          <b>Placing {placing.label}</b> · {placing.hints}
        </div>
      )}
      <div>
        {LEGEND}
        {TOOL_HINTS[tool] ?? ''}
      </div>
    </div>
  );
}

function Workspace() {
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  useShortcuts();
  return (
    <div className={'app' + (sidebarOpen ? '' : ' noright')}>
      <Toolbar />
      <LibraryPanel />
      <main className="stage">
        <Canvas />
        <Legend />
      </main>
      <FileTabs />
      {sidebarOpen && <InspectorPanel />}
    </div>
  );
}

/** Keyed by the reset count, so resetting the workspace remounts everything with fresh local state. */
export default function App() {
  return <Workspace key={useStore((s) => s.epoch)} />;
}
