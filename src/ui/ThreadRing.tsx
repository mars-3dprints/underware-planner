/** Dashed ring inside a threaded hole of radius `r`, centred in a unit cell. */
export const ThreadRing = ({ r, stroke }: { r: number; stroke: string }) => (
  <circle
    cx={0.5}
    cy={0.5}
    r={r * 0.75}
    fill="none"
    stroke={stroke}
    strokeWidth={0.04}
    strokeDasharray="0.05 0.04"
  />
);
