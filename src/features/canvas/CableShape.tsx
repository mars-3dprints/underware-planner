import { memo } from 'react';
import type { Cable } from '../../domain/types';
import { cellCenter } from '../../routing/paths';
import { type Route, routePath } from '../../routing/route';

interface CableShapeProps {
  cable: Cable;
  route: Route;
  selected: boolean;
  /** While some cables are in focus (hovered, or attached to the selected objects): glow if this one is, else fade. */
  focus: 'glow' | 'dim' | null;
  /** Stroke width in cells. */
  width: number;
  /** Pixels per cell. */
  zoom: number;
  /** Adds an invisible wide stroke for clicking (select tool only). */
  interactive: boolean;
}

/** A cable with a halo, its ends (filled when attached, hollow when loose) and a click target. */
export const CableShape = memo(function CableShape({
  cable,
  route,
  selected,
  focus,
  width,
  zoom,
  interactive,
}: CableShapeProps) {
  const px = (pixels: number) => pixels / zoom;
  const d = routePath(route);
  const ends = [
    { at: cellCenter(route.pts[0]), loose: cable.a.objId === undefined },
    { at: cellCenter(route.pts[route.pts.length - 1]), loose: cable.b.objId === undefined },
  ];
  // Selected cables get the accent halo; focused ones glow in their own colour, so they don't look selected.
  const halo = selected
    ? { stroke: 'var(--accent)', grow: 8 }
    : focus === 'glow'
      ? { stroke: cable.color, grow: 10 }
      : null;
  return (
    <g opacity={focus === 'dim' ? 0.15 : 1}>
      {halo && (
        <path
          d={d}
          fill="none"
          stroke={halo.stroke}
          strokeWidth={width + px(halo.grow)}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.35}
          pointerEvents="none"
        />
      )}
      <path
        d={d}
        fill="none"
        stroke="var(--canvas)"
        strokeWidth={width + px(3)}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
        pointerEvents="none"
      />
      <path
        d={d}
        fill="none"
        stroke={cable.color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
      />
      {ends.map((end, i) => (
        <circle
          key={i}
          cx={end.at.x}
          cy={end.at.y}
          r={width * 0.95}
          fill={end.loose ? '#fff' : cable.color}
          stroke={end.loose ? cable.color : '#fff'}
          strokeWidth={end.loose ? 2.5 : 1.5}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      ))}
      {interactive && (
        <path
          data-k="cable"
          data-id={cable.id}
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(0.4, px(10))}
          strokeLinecap="round"
          style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        />
      )}
    </g>
  );
});
