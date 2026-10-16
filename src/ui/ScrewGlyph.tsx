import { SCREW_COLOR } from '../domain/screws';

/** A screw head, for the library button and the bill of materials. */
export function ScrewGlyph({ size = 30, color = SCREW_COLOR }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="6.5" fill={color} stroke="rgba(0,0,0,.55)" strokeWidth="1.5" />
      <path
        d="M10.5 14h7M14 10.5v7"
        fill="none"
        stroke="rgba(0,0,0,.55)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
