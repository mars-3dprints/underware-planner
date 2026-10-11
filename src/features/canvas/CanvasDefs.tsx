import { TILE_HOLE_PATH } from '../../domain/pieces';
import type { View } from '../../domain/types';

/** Background grid, plus the patterns that draw openGrid tiles. */
export function CanvasDefs({ view }: { view: View }) {
  const gridTransform = `translate(${view.x} ${view.y}) scale(${view.k})`;
  return (
    <defs>
      <pattern
        id="g-minor"
        width={1}
        height={1}
        patternUnits="userSpaceOnUse"
        patternTransform={gridTransform}
      >
        <path d="M0 0H1M0 0V1" fill="none" stroke="var(--grid-minor)" strokeWidth={2 / view.k} />
      </pattern>
      <pattern
        id="g-major"
        width={5}
        height={5}
        patternUnits="userSpaceOnUse"
        patternTransform={gridTransform}
      >
        <path d="M0 0H5M0 0V5" fill="none" stroke="var(--grid-major)" strokeWidth={2.5 / view.k} />
      </pattern>
      <pattern id="og-cell" width={1} height={1} patternUnits="userSpaceOnUse">
        <rect
          x={0.03}
          y={0.03}
          width={0.94}
          height={0.94}
          rx={0.1}
          fill="none"
          stroke="rgba(0,0,0,.28)"
          strokeWidth={0.03}
        />
      </pattern>
      <pattern id="og-holes" width={1} height={1} patternUnits="userSpaceOnUse">
        <path d={TILE_HOLE_PATH} fill="#000" />
      </pattern>
      <pattern id="og-rim" width={1} height={1} patternUnits="userSpaceOnUse">
        <path d={TILE_HOLE_PATH} fill="none" stroke="rgba(0,0,0,.4)" strokeWidth={0.035} />
      </pattern>
    </defs>
  );
}

/** Canvas background with minor and major grid lines, faded out when zoomed far out. */
export function CanvasGrid({ zoom }: { zoom: number }) {
  return (
    <>
      <rect width="100%" height="100%" fill="var(--canvas)" />
      <rect width="100%" height="100%" fill="url(#g-minor)" opacity={zoom >= 9 ? 1 : 0} />
      <rect width="100%" height="100%" fill="url(#g-major)" opacity={zoom >= 3 ? 1 : 0} />
    </>
  );
}
