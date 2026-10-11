import type { Sub } from './types';
import { pieceOf, portsOf } from './types';

const OCT = 'M.36 .2H.64L.8 .36V.64L.64 .8H.36L.2 .64V.36Z';

/** Small picture of an add-on, drawn from the same shapes the canvas uses. */
export function PieceThumb({ sub, len = 3, size = 34, flip = false }: { sub: Sub; len?: number; size?: number; flip?: boolean }) {
  if (sub === 'hole' || sub === 'wall') {
    const d = sub === 'wall' ? `${OCT}M.4 .5a.1 .1 0 1 0 .2 0a.1 .1 0 1 0 -.2 0Z` : OCT;
    return <svg width={size} height={size} viewBox="0 0 1 1" aria-hidden="true"><path d={d} transform="translate(.5 .5) scale(1.3) translate(-.5 -.5)" fill="currentColor" fillRule="evenodd" /></svg>;
  }
  const linear = sub === 'straight' || sub === 'bridge', pc = pieceOf(sub, len);
  const w = linear ? Math.max(len, sub === 'bridge' ? 3 : 1) : pc?.w ?? 1, h = linear ? 1 : pc?.h ?? 1, pad = 0.15;
  const d = linear ? `M0 0H${w}V1H0Z` : pc?.d ?? '';
  return (
    <svg width={size} height={size} viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`} aria-hidden="true">
      <g transform={flip ? `translate(${w} 0) scale(-1 1)` : undefined}>
      <path d={d} fill="currentColor" stroke="currentColor" strokeWidth={0.06} strokeLinejoin="round" />
      {pc?.sep && <path d={pc.sep} fill="none" stroke="var(--panel)" strokeWidth={0.07} strokeLinecap="round" />}
      {sub === 'bridge' && <rect x={1} y={0.12} width={w - 2} height={0.76} fill="var(--panel)" opacity={0.45} />}
      </g>
    </svg>
  );
}
