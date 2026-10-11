import { useCallback, useRef, useState } from 'react';
import { type Layer, LAYERS, layerOf } from '../domain/layers';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store/store';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { useDismiss } from '../ui/useDismiss';

/** Layers button with a menu to show or hide each layer. */
export function LayersMenu() {
  const { doc, hidden, toggleLayer } = useStore(
    useShallow((s) => ({ doc: s.doc, hidden: s.hidden, toggleLayer: s.toggleLayer })),
  );
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);
  const count = (layer: Layer) =>
    layer === 'cables' ? doc.cables.length : doc.objects.filter((p) => layerOf(p) === layer).length;

  return (
    <span className="popwrap" ref={ref}>
      <IconButton
        icon="layers"
        label="Layers (1–4)"
        on={open || LAYERS.some((l) => hidden[l.id])}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div className="pop right" role="dialog" aria-label="Layers">
          <span className="sub">Layers</span>
          {LAYERS.map((layer, i) => (
            <button
              key={layer.id}
              className={'layerrow' + (hidden[layer.id] ? ' off' : '')}
              onClick={() => toggleLayer(layer.id)}
              aria-pressed={!hidden[layer.id]}
            >
              <Icon name={hidden[layer.id] ? 'eyeoff' : 'peek'} />
              <span>{layer.label}</span>
              <span className="n">{count(layer.id)}</span>
              <kbd>{i + 1}</kbd>
            </button>
          ))}
          <p className="hint">
            Hidden layers can't be selected. Placing a part shows its layer again. The bill of materials
            always counts everything.
          </p>
        </div>
      )}
    </span>
  );
}
