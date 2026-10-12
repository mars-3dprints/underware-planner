import { openingsMaskPath, type Port } from '../domain/ports';

interface InsetMaskProps {
  id: string;
  /** Outline to inset, and the transform that places it. */
  d: string;
  transform?: string;
  /** Openings kept flush, and the transform that places them. */
  ports: Port[];
  portsTransform?: string;
  inset: number;
  /** Area the mask covers, in user units. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Mask that draws a channel `inset` narrower on every side, with its openings kept flush. */
export function InsetMask({ id, d, transform, ports, portsTransform, inset, x, y, w, h }: InsetMaskProps) {
  return (
    <mask id={id} maskUnits="userSpaceOnUse" x={x - 1} y={y - 1} width={w + 2} height={h + 2}>
      <rect x={x - 1} y={y - 1} width={w + 2} height={h + 2} fill="#fff" />
      <path
        d={d}
        transform={transform}
        fill="none"
        stroke="#000"
        strokeWidth={inset * 2}
        strokeLinejoin="miter"
      />
      {ports.length > 0 && (
        <path
          d={openingsMaskPath(ports, inset * 2 + 0.02, 0.5 - inset)}
          transform={portsTransform}
          fill="#fff"
        />
      )}
    </mask>
  );
}
