import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { overlapsFor } from '../../bom/overlaps';
import { deviceAt } from '../../domain/anchors';
import { blockPart, makePiece } from '../../domain/doc';
import { isBridge } from '../../domain/pieces';
import { canPlaceScrew, makeScrew } from '../../domain/screws';
import { attachedCables } from '../../domain/group';
import type { Cell, Part } from '../../domain/types';
import { cellPath } from '../../routing/paths';
import { routesFor } from '../../routing/route';
import { isGroupSelected, selectedCable, selectedPart, useStore } from '../../store/store';
import { fitToContent } from '../../store/view';
import { CableShape } from './CableShape';
import { CableTip } from './CableTip';
import { CanvasDefs, CanvasGrid } from './CanvasDefs';
import { PartShape } from './PartShape';
import { RenameInput } from './RenameInput';
import { CableHandles, CableOutline, GroupOutline, HoverOutline, PartOutline } from './SelectionOverlay';
import { useCableDraft } from './useCableDraft';
import { type Marquee, usePointerInput } from './usePointerInput';
import { useCanvasKeys, useWheelPanZoom } from './useViewportControls';

/** Labels are drawn from this zoom (pixels per cell) up. */
const LABEL_ZOOM = 14;
const GHOST_ID = 'ghost';

/** What the place tool would put down at the hovered cell. */
function useGhost(hover: Cell | null): Part | null {
  const { tool, block, stamp } = useStore(
    useShallow((s) => ({ tool: s.tool, block: s.block, stamp: s.stamp })),
  );
  if (tool !== 'place' || !hover) return null;
  if (block) return { ...blockPart(block, hover), id: GHOST_ID };
  if (stamp) {
    const { sub, len, rot, flip, color } = stamp;
    return { ...makePiece(sub, hover.x, hover.y, len, rot, flip, color), id: GHOST_ID };
  }
  return null;
}

/** The infinite SVG canvas: tiles, objects, cables and channels, with all pointer interaction. */
export function Canvas() {
  const {
    doc,
    tool,
    view,
    activeWaypoint,
    selectedIds,
    selectedCableIds,
    peek,
    hoverCableIds,
    hoverPartIds,
    screwGhost,
    hidden,
    isGroup,
    part,
    cable,
  } = useStore(
    useShallow((s) => ({
      doc: s.doc,
      tool: s.tool,
      view: s.view,
      activeWaypoint: s.activeWaypoint,
      selectedIds: s.selectedIds,
      selectedCableIds: s.selectedCableIds,
      peek: s.peek,
      hoverCableIds: s.hoverCableIds,
      hoverPartIds: s.hoverPartIds,
      screwGhost: s.screwGhost,
      hidden: s.hidden,
      isGroup: isGroupSelected(s),
      part: selectedPart(s),
      cable: selectedCable(s),
    })),
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const routes = routesFor(doc);
  const overlaps = overlapsFor(doc);
  const [hover, setHover] = useState<Cell | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const draft = useCableDraft(hover);
  // Cables in focus, the rest fade: the hovered ones, else those attached to the selected objects.
  const focusIds = useMemo(() => {
    if (hoverCableIds.length) return new Set(hoverCableIds);
    const attached = attachedCables(doc.cables, new Set(selectedIds));
    return attached.length ? new Set([...attached.map((c) => c.id), ...selectedCableIds]) : null;
  }, [doc.cables, selectedIds, selectedCableIds, hoverCableIds]);
  // Parts hovered in the bill of materials.
  const hoverParts = useMemo(() => {
    const ids = new Set(hoverPartIds);
    return ids.size ? doc.objects.filter((p) => ids.has(p.id)) : [];
  }, [doc.objects, hoverPartIds]);
  const ghost = useGhost(hover);

  useWheelPanZoom(svgRef);
  const spaceHeld = useCanvasKeys({ onCancel: draft.cancel, onFinish: draft.finishAtHover });
  const input = usePointerInput({
    svgRef,
    routes,
    spaceHeld,
    draft,
    setHover,
    setMarquee,
    startRename: setRenaming,
  });

  useEffect(() => {
    if (!useStore.getState().viewRestored) fitToContent();
  }, []);
  const { cancel } = draft;
  useEffect(() => {
    if (tool !== 'cable') cancel();
    if (tool === 'select') setHover(null);
  }, [tool, cancel]);

  const px = (pixels: number) => pixels / view.k;
  const selectedRoute = cable && routes.get(cable.id);
  const cableWidth = Math.max(0.16, 3 / view.k);
  const showLabels = view.k >= LABEL_ZOOM;
  const hoveringDevice = tool === 'cable' && hover && deviceAt(doc, hover, hidden.objects);
  const panning = spaceHeld || tool === 'pan' || input.drag.current?.t === 'pan';
  const cursor = panning ? 'grab' : tool === 'select' ? 'default' : 'crosshair';
  const renamed = renaming ? doc.objects.find((p) => p.id === renaming) : undefined;

  const shape = (p: Part) => (
    <PartShape
      key={p.id}
      part={p}
      overlapping={overlaps.has(p.id)}
      showLabel={showLabels && renaming !== p.id}
      zoom={view.k}
    />
  );
  const ofKind = (kind: Part['kind']) => doc.objects.filter((p) => p.kind === kind);
  const channels = ofKind('raceway');

  return (
    <>
      <svg
        ref={svgRef}
        className="canvas"
        style={{ cursor }}
        onPointerDown={input.onPointerDown}
        onPointerMove={input.onPointerMove}
        onPointerUp={input.onPointerUp}
        onPointerLeave={input.onPointerLeave}
        onContextMenu={input.onContextMenu}
      >
        <CanvasDefs view={view} />
        <CanvasGrid zoom={view.k} />
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {!hidden.tiles && ofKind('plate').map(shape)}
          {!hidden.tiles && ofKind('snap').map(shape)}
          {!hidden.tiles && ofKind('screw').map(shape)}
          {!hidden.objects && ofKind('object').map(shape)}

          {!hidden.cables &&
            doc.cables.map((c) => {
              const route = routes.get(c.id);
              return (
                route && (
                  <CableShape
                    key={c.id}
                    cable={c}
                    route={route}
                    selected={selectedCableIds.includes(c.id)}
                    focus={focusIds && (focusIds.has(c.id) ? 'glow' : 'dim')}
                    width={cableWidth}
                    zoom={view.k}
                    interactive={tool === 'select'}
                  />
                )
              );
            })}

          {/* Channels sit above cables and hide them; bridges sit above other channels. */}
          <g opacity={peek ? 0.75 : 1} display={hidden.channels ? 'none' : undefined}>
            {channels.filter((p) => !isBridge(p.sub)).map(shape)}
            {channels.filter((p) => isBridge(p.sub)).map(shape)}
          </g>

          {hoverParts.length > 0 && <HoverOutline parts={hoverParts} />}
          {selectedRoute && <CableOutline route={selectedRoute} />}
          {isGroup && (
            <GroupOutline
              parts={doc.objects.filter((p) => selectedIds.includes(p.id))}
              cables={doc.cables.filter((c) => selectedCableIds.includes(c.id))}
              routes={routes}
            />
          )}
          {part && <PartOutline part={part} px={px} />}
          {cable && selectedRoute && tool === 'select' && (
            <CableHandles cable={cable} route={selectedRoute} activeWaypoint={activeWaypoint} px={px} />
          )}

          {ghost && <PartShape part={ghost} ghost overlapping={false} showLabel={showLabels} zoom={view.k} />}
          {screwGhost && (
            <PartShape
              part={makeScrew(screwGhost, GHOST_ID)}
              ghost
              overlapping={!canPlaceScrew(doc, screwGhost)}
              showLabel={false}
              zoom={view.k}
            />
          )}
          {marquee && (
            <rect
              x={marquee.x0}
              y={marquee.y0}
              width={marquee.x1 - marquee.x0}
              height={marquee.y1 - marquee.y0}
              fill="var(--accent)"
              fillOpacity={0.1}
              stroke="var(--accent)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
          {tool === 'cable' && hover && (
            <rect
              x={hover.x}
              y={hover.y}
              width={1}
              height={1}
              rx={0.1}
              fill={hoveringDevice ? 'var(--accent)' : 'transparent'}
              fillOpacity={0.22}
              stroke="var(--accent)"
              strokeWidth={1.5}
              strokeDasharray={hoveringDevice ? undefined : '4 3'}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
          {draft.draft && draft.preview && (
            <path
              d={cellPath(draft.preview)}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={cableWidth}
              strokeDasharray={`${cableWidth * 2} ${cableWidth * 1.5}`}
              strokeLinecap="round"
              pointerEvents="none"
            />
          )}
          {draft.draft?.waypoints.map((p, i) => (
            <circle
              key={i}
              cx={p.x + 0.5}
              cy={p.y + 0.5}
              r={px(5)}
              fill="var(--accent)"
              pointerEvents="none"
            />
          ))}
        </g>
      </svg>
      <CableTip svgRef={svgRef} />
      {renamed && <RenameInput part={renamed} view={view} onDone={() => setRenaming(null)} />}
    </>
  );
}
