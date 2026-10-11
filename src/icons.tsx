const P: Record<string, JSX.Element> = {
  select: <path d="M5 3l11 6.5-5 1.4L8.5 16.5z" />,
  pan: <g transform="scale(.8333)"><path d="M18 11V6a2 2 0 0 0-4 0" /><path d="M14 10V4a2 2 0 0 0-4 0v2" /><path d="M10 10.5V6a2 2 0 0 0-4 0v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" /></g>,
  cable: <><circle cx="4.5" cy="14.5" r="1.8" /><circle cx="15.5" cy="5.5" r="1.8" /><path d="M6.3 14.5H10a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2h-.3" /></>,
  undo: <path d="M7 4L3 8l4 4M3 8h8a5 5 0 0 1 0 10H8" />,
  redo: <path d="M13 4l4 4-4 4M17 8H9a5 5 0 0 0 0 10h3" />,
  rotate: <path d="M16.5 10a6.5 6.5 0 1 1-2.2-4.9M16.5 3v3.5H13" />,
  flip: <><path d="M10 2.5v15" strokeDasharray="2 2" /><path d="M7.5 5.5L3 10l4.5 4.5z" /><path d="M12.5 5.5L17 10l-4.5 4.5z" /></>,
  copy: <><rect x="7" y="7" width="10" height="10" rx="2" /><path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /></>,
  duplicate: <><rect x="3" y="7" width="10" height="10" rx="2" /><path d="M10 3h5a2 2 0 0 1 2 2v5M8 12h0M8 10v4M6 12h4" /></>,
  delpoint: <><circle cx="10" cy="10" r="3" /><path d="M3 10h4M13 10h4" strokeDasharray="0" /><path d="M14.5 3.5l3 3M17.5 3.5l-3 3" /></>,
  reset: <><path d="M3 16h4V9h6V4h4" strokeDasharray="1.5 2.5" opacity=".55" /><circle cx="3.5" cy="16" r="1.6" /><circle cx="16.5" cy="4" r="1.6" /><path d="M5 14.8L15 5.2" /></>,
  style: <><path d="M3 16V9a4 4 0 0 1 4-4h2" /><path d="M11 16l6-6" /><path d="M11 16v-3M11 16h3" /></>,
  peek: <><path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z" /><circle cx="10" cy="10" r="2.3" /></>,
  sidebar: <><rect x="2.5" y="3.5" width="15" height="13" rx="2" /><path d="M12 3.5v13" /></>,
  trash: <path d="M4 6h12M8 6V4h4v2M6 6l.8 10.5h6.4L14 6M8.5 9v5M11.5 9v5" />,
};
export function Icon({ name, size = 18 }: { name: keyof typeof P; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[name]}</svg>;
}
