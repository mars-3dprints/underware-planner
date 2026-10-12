import { memo, type SVGProps } from 'react';
import { TILE_LABEL } from '../../domain/constants';
import { channelGeometry, channelPorts, matrixAttr } from '../../domain/geometry';
import { isVertical, SNAP_HOLES, TILE_HOLE_PATH } from '../../domain/pieces';
import type { Part } from '../../domain/types';
import { readableTextColor } from '../../ui/color';
import { InsetMask } from '../../ui/InsetMask';
import { ThreadRing } from '../../ui/ThreadRing';
import { wrapText } from './wrapText';

/** Channels are drawn this much narrower (cells) on each side, with their openings kept flush. */
const CHANNEL_INSET = 0.06;
const LINE_HEIGHT = 0.34;
const SIZE_LINE = 0.28;

const noPointer = { pointerEvents: 'none', userSelect: 'none' } as const;
const outline = (overlapping: boolean, color: string) => (overlapping ? 'var(--danger)' : color);

interface PartShapeProps {
  part: Part;
  /** Placement preview: translucent and not interactive. */
  ghost?: boolean;
  overlapping: boolean;
  showLabel: boolean;
  /** Pixels per cell. */
  zoom: number;
}

interface ShapeProps {
  part: Part;
  overlapping: boolean;
  showLabel: boolean;
  zoom: number;
  props: SVGProps<SVGGElement>;
}

function TileShape({ part: p, overlapping, showLabel, props }: ShapeProps) {
  return (
    <g {...props}>
      <mask id={`pm-${p.id}`} maskUnits="userSpaceOnUse" x={p.x} y={p.y} width={p.w} height={p.h}>
        <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="#fff" />
        <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="url(#og-holes)" />
      </mask>
      <g mask={`url(#pm-${p.id})`}>
        <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={0.12} fill={p.color} />
        <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="url(#og-cell)" />
      </g>
      <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="url(#og-rim)" />
      <rect
        x={p.x}
        y={p.y}
        width={p.w}
        height={p.h}
        rx={0.12}
        fill="none"
        stroke={outline(overlapping, 'rgba(0,0,0,.4)')}
        strokeWidth={overlapping ? 2.5 : 1.25}
        strokeDasharray={overlapping ? '6 4' : undefined}
        vectorEffect="non-scaling-stroke"
      />
      {showLabel && (
        <text x={p.x + 0.12} y={p.y + 0.3} fontSize={0.24} fill="rgba(0,0,0,.6)" style={noPointer}>
          {/* Tiles aren't named; a name from an older save is kept in the layout but not shown. */}
          {TILE_LABEL} {p.h}×{p.w}
        </text>
      )}
    </g>
  );
}

function SnapShape({ part: p, overlapping, props }: ShapeProps) {
  const hole = p.sub && SNAP_HOLES[p.sub];
  return (
    <g transform={`translate(${p.x} ${p.y})`} {...props}>
      <path
        d={TILE_HOLE_PATH}
        transform="translate(.5 .5) scale(1.14) translate(-.5 -.5)"
        fill={p.color}
        stroke={outline(overlapping, 'rgba(0,0,0,.55)')}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {hole && (
        <>
          <circle
            cx={0.5}
            cy={0.5}
            r={hole.r}
            fill="var(--canvas)"
            stroke="rgba(0,0,0,.65)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {hole.threaded && <ThreadRing r={hole.r} stroke={p.color} />}
        </>
      )}
    </g>
  );
}

/**
 * A channel: a dark border and a coloured body, each masked to stay `inset` inside the outline except at the
 * openings, which stay flush so neighbouring channels join up.
 */
function ChannelShape({ part: p, overlapping, zoom, props }: ShapeProps) {
  const { d, m, sep } = channelGeometry(p);
  const transform = m ? matrixAttr(m) : undefined;
  const length = Math.max(p.w, p.h);
  const openings = channelPorts(p);
  const border = (overlapping ? 3 : 1.6) / zoom;
  const insetMask = (id: string, inset: number) => (
    <InsetMask
      id={id}
      d={d}
      transform={transform}
      ports={openings.ports}
      portsTransform={openings.m ? matrixAttr(openings.m) : undefined}
      inset={inset}
      x={p.x}
      y={p.y}
      w={p.w}
      h={p.h}
    />
  );
  return (
    <g {...props}>
      {p.sub === 'bridge' && (
        <path d={channelGeometry({ ...p, x: p.x + 0.05, y: p.y + 0.07 }).d} fill="rgba(0,0,0,.28)" />
      )}
      <defs>
        {insetMask(`cm1-${p.id}`, CHANNEL_INSET)}
        {insetMask(`cm2-${p.id}`, CHANNEL_INSET + border)}
      </defs>
      <g mask={`url(#cm1-${p.id})`}>
        <path d={d} transform={transform} fill={outline(overlapping, 'rgba(0,0,0,.6)')} />
      </g>
      <g mask={`url(#cm2-${p.id})`}>
        <path d={d} transform={transform} fill={p.color} />
      </g>
      {sep && (
        <path
          d={sep}
          transform={transform}
          fill="none"
          stroke="rgba(0,0,0,.6)"
          strokeWidth={2}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {p.sub === 'bridge' && length >= 3 && (
        <rect
          {...(isVertical(p)
            ? { x: p.x + 0.1, y: p.y + 1, width: 0.8, height: length - 2 }
            : { x: p.x + 1, y: p.y + 0.1, width: length - 2, height: 0.8 })}
          fill="rgba(255,255,255,.3)"
          stroke="rgba(0,0,0,.5)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
}

/** A custom object, with its name wrapped to fit and its size underneath when there is room. */
function DeviceShape({ part: p, overlapping, showLabel, props }: ShapeProps) {
  const textColor = readableTextColor(p.color);
  const maxChars = Math.max(3, Math.floor((p.w - 0.2) * 5.2));
  const maxLines = Math.max(1, Math.floor((p.h - 0.1) / LINE_HEIGHT));
  let lines = wrapText(p.name, maxChars);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…';
  }
  const showSize = lines.length * LINE_HEIGHT + SIZE_LINE <= p.h - 0.1;
  const textHeight = lines.length * LINE_HEIGHT + (showSize ? SIZE_LINE : 0);
  const top = p.y + p.h / 2 - textHeight / 2;
  const cx = p.x + p.w / 2;
  return (
    <g {...props}>
      <rect
        x={p.x + 0.05}
        y={p.y + 0.05}
        width={p.w - 0.1}
        height={p.h - 0.1}
        rx={0.14}
        fill={p.color}
        stroke={outline(overlapping, 'rgba(0,0,0,.45)')}
        strokeWidth={overlapping ? 2.5 : 1.25}
        vectorEffect="non-scaling-stroke"
      />
      {showLabel && (
        <>
          {lines.map((line, i) => (
            <text
              key={i}
              x={cx}
              y={top + (i + 0.5) * LINE_HEIGHT}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={0.3}
              fontWeight={600}
              fill={textColor}
              style={noPointer}
            >
              {line}
            </text>
          ))}
          {showSize && (
            <text
              x={cx}
              y={top + lines.length * LINE_HEIGHT + 0.14}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={0.2}
              fill={textColor}
              opacity={0.75}
              style={noPointer}
            >
              {p.w}×{p.h}
            </text>
          )}
        </>
      )}
    </g>
  );
}

const SHAPES = { plate: TileShape, snap: SnapShape, raceway: ChannelShape, object: DeviceShape };

/** Any part. Interactive parts carry `data-k="obj"` and `data-id` for pointer handling. */
export const PartShape = memo(function PartShape({ part, ghost = false, ...rest }: PartShapeProps) {
  const Shape = SHAPES[part.kind];
  const props: SVGProps<SVGGElement> = ghost
    ? { opacity: 0.65, pointerEvents: 'none' }
    : ({
        'data-k': 'obj',
        'data-id': part.id,
        className: part.noBom ? 'no-bom' : undefined,
      } as SVGProps<SVGGElement>);
  return <Shape part={part} props={props} {...rest} />;
});
