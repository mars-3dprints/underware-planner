/** Dark or light text, whichever reads better on a `#rrggbb` background. */
export function readableTextColor(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const luma = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return luma > 150 ? '#1b1b1b' : '#ffffff';
}
