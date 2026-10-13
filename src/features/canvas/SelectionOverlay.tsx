import { drawnBounds } from '../../domain/group';
import { isLinear, isTurn } from '../../domain/pieces';
import type { Cable, Part } from '../../domain/types';
import { waypointHandle } from '../../routing/paths';
import { type Route, routePath } from '../../routing/route';

type Px = (pixels: number) => number;

/** Tiles, custom objects, straights and turns can be resized by dragging their corner. */
const canResize = (part: Part) =>
  part.kind === 'plate' || part.kind === 'object' || isLinear(part.sub) || isTurn(part.sub);

/** Outline of each selected part and a dashed box around the whole group. */
export function GroupOutline({
  parts,
  cables,
  routes,
}: {
  parts: Part[];
  cables: Cable[];
  routes: Map<string, Route>;
}) {
  const box = drawnBounds(parts, cables, routes);
  return (
    <g pointerEvents="none">
      {parts.map((p) => (
        <rect
          key={p.id}
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <rect
        x={box.x - 0.08}
        y={box.y - 0.08}
        width={box.w + 0.16}
        height={box.h + 0.16}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeDasharray="6 4"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

/** Outline of the selected part, with a resize handle where it applies. */
export function PartOutline({ part, px }: { part: Part; px: Px }) {
  return (
    <g>
      <rect
        x={part.x}
        y={part.y}
        width={part.w}
        height={part.h}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {canResize(part) && (
        <rect
          data-k="resize"
          data-id={part.id}
          x={part.x + part.w - px(6)}
          y={part.y + part.h - px(6)}
          width={px(12)}
          height={px(12)}
          fill="#fff"
          stroke="var(--accent)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          style={{ cursor: 'nwse-resize' }}
        />
      )}
    </g>
  );
}

/** Dashed accent line over the selected cable. */
export function CableOutline({ route }: { route: Route }) {
  return (
    <path
      d={routePath(route)}
      fill="none"
      stroke="var(--accent)"
      strokeWidth={2}
      strokeDasharray="5 4"
      vectorEffect="non-scaling-stroke"
      strokeLinecap="round"
      pointerEvents="none"
    />
  );
}

interface CableHandlesProps {
  cable: Cable;
  route: Route;
  activeWaypoint: number | null;
  px: Px;
}

/** Draggable waypoints (round) and ends (square) of the selected cable. */
export function CableHandles({ cable, route, activeWaypoint, px }: CableHandlesProps) {
  const ends = [route.pts[0], route.pts[route.pts.length - 1]];
  return (
    <>
      {cable.waypoints.map((waypoint, i) => {
        const at = waypointHandle(route.draw, waypoint);
        return (
          <circle
            key={i}
            data-k="wp"
            data-id={cable.id}
            data-i={i}
            cx={at.x}
            cy={at.y}
            r={px(activeWaypoint === i ? 7 : 6)}
            fill={activeWaypoint === i ? 'var(--accent)' : '#fff'}
            stroke="var(--accent)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            style={{ cursor: 'move' }}
          />
        );
      })}
      {ends.map((p, i) => (
        <rect
          key={i}
          data-k="end"
          data-id={cable.id}
          data-end={i === 0 ? 'a' : 'b'}
          x={p.x + 0.5 - px(7)}
          y={p.y + 0.5 - px(7)}
          width={px(14)}
          height={px(14)}
          rx={px(3)}
          fill="#fff"
          stroke="var(--accent)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          style={{ cursor: 'grab' }}
        />
      ))}
    </>
  );
}

/** Translucent highlight over parts hovered in the bill of materials. */
export function HoverOutline({ parts }: { parts: Part[] }) {
  return (
    <g pointerEvents="none">
      {parts.map((p) => (
        <rect
          key={p.id}
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          fill="var(--accent)"
          fillOpacity={0.3}
          stroke="var(--accent)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}
