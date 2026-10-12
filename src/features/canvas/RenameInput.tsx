import { useRef } from 'react';
import { patchPart } from '../../domain/doc';
import type { Part, View } from '../../domain/types';
import { useStore } from '../../store/store';

/** Inline name editor, centred over a custom object. Enter or blur saves, Esc cancels. */
export function RenameInput({ part, view, onDone }: { part: Part; view: View; onDone: () => void }) {
  const cancelled = useRef(false);
  const style = {
    left: view.x + part.x * view.k + 4,
    top: view.y + (part.y + part.h / 2) * view.k - 14,
    width: Math.max(100, part.w * view.k - 8),
  };

  const save = (value: string) => {
    const name = value.trim();
    if (!cancelled.current && name && name !== part.name) {
      useStore.getState().commit((d) => patchPart(d, part.id, { name }));
    }
    cancelled.current = false;
    onDone();
  };

  return (
    <input
      className="rename"
      autoFocus
      defaultValue={part.name}
      aria-label="Rename"
      style={style}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => save(e.currentTarget.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );
}
