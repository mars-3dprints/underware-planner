interface NumberFieldProps {
  label: string;
  value: number;
  min?: number;
  onChange: (n: number) => void;
}

/** Whole-number input that ignores values below `min`. */
export function NumberField({ label, value, min = 1, onChange }: NumberFieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        step={1}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n) && n >= min) onChange(n);
        }}
      />
    </label>
  );
}
