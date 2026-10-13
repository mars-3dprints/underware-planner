import { Canvas } from '../features/canvas/Canvas';
import { InspectorPanel } from '../features/panels/InspectorPanel';
import { LibraryPanel } from '../features/panels/LibraryPanel';
import type { Tool } from '../domain/types';
import { useStore } from '../store/store';
import { FileTabs } from './FileTabs';
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

function Legend() {
  const tool = useStore((s) => s.tool);
  return (
    <div className="legend">
      {LEGEND}
      {TOOL_HINTS[tool] ?? ''}
    </div>
  );
}

export default function App() {
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
