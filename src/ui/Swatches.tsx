import { useEffect, useRef } from 'react';
import { DEFAULT_COLORS } from '../domain/constants';
import { useStore } from '../store/store';

interface SwatchesProps {
  value: string;
  onChange: (color: string) => void;
  /** Extra colours shown first (not removable). */
  extra?: string[];
}

function Swatch({ color, on, onPick }: { color: string; on: boolean; onPick: () => void }) {
  return (
    <button
      className={'sw' + (on ? ' on' : '')}
      style={{ background: color }}
      onClick={onPick}
      aria-label={color}
    />
  );
}

/** Built-in and custom colours, with a picker that adds a custom colour. */
export function Swatches({ value, onChange, extra = [] }: SwatchesProps) {
  const palette = useStore((s) => s.palette);
  const addColor = useStore((s) => s.addColor);
  const removeColor = useStore((s) => s.removeColor);
  const pickerRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    // The native 'change' event fires once, when the colour dialog is confirmed, so dragging inside it adds nothing.
    const picker = pickerRef.current;
    if (!picker) return;
    const onConfirm = () => {
      addColor(picker.value);
      onChangeRef.current(picker.value.toLowerCase());
    };
    picker.addEventListener('change', onConfirm);
    return () => picker.removeEventListener('change', onConfirm);
  }, [addColor]);

  return (
    <div className="swatches">
      {[...extra, ...DEFAULT_COLORS].map((c) => (
        <Swatch key={c} color={c} on={c === value} onPick={() => onChange(c)} />
      ))}
      {palette.map((c) => (
        <span key={c} className="swwrap">
          <Swatch color={c} on={c === value} onPick={() => onChange(c)} />
          <button
            className="swx"
            onClick={() => removeColor(c)}
            aria-label={`Remove ${c}`}
            title="Remove colour"
          >
            ×
          </button>
        </span>
      ))}
      <label className="sw picker" title="Add colour">
        <input
          ref={pickerRef}
          type="color"
          defaultValue="#4361ee"
          aria-label="Add colour"
          onClick={(e) => {
            if (/^#[0-9a-f]{6}$/i.test(value)) e.currentTarget.value = value;
          }}
        />
      </label>
    </div>
  );
}
