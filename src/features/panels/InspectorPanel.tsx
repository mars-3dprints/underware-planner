import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { billOfMaterials, type BillOfMaterials } from '../../bom/billOfMaterials';
import { overlapsFor } from '../../bom/overlaps';
import { routesFor } from '../../routing/route';
import { useStore } from '../../store/store';
import { ColorDot } from '../../ui/ColorDot';
import { Icon } from '../../ui/Icon';
import { BillOfMaterialsSection } from './BillOfMaterialsSection';
import { Section } from './Section';

/** A cable being dragged in the list, from index `from` to where it would land, `to`. */
interface CableDrag {
  id: string;
  from: number;
  to: number;
}

/**
 * Drag classes for list item `i`: the dragged row, or a drop line on the side of the cable it would land next to.
 */
function dragClass(drag: CableDrag | null, i: number) {
  if (!drag) return '';
  if (drag.from === i) return ' dragging';
  if (drag.to !== i) return '';
  return drag.to < drag.from ? ' drop-before' : ' drop-after';
}

/** The cable list, in drawing order (later cables are drawn on top). Drag a cable to reorder. */
function CablesSection({ bom }: { bom: BillOfMaterials }) {
  const { selectedCableIds, select, setHoverCables, moveCable } = useStore(
    useShallow((s) => ({
      selectedCableIds: s.selectedCableIds,
      select: s.select,
      setHoverCables: s.setHoverCables,
      moveCable: s.moveCable,
    })),
  );
  const [drag, setDrag] = useState<CableDrag | null>(null);
  return (
    <Section id="cables" title="Cables" aside={<small>{(bom.cableMm / 1000).toFixed(2)} m total</small>}>
      {bom.cables.length ? (
        <ul className="list">
          {bom.cables.map((cable, i) => (
            <li
              key={cable.id}
              className={(selectedCableIds.includes(cable.id) ? 'on' : '') + dragClass(drag, i)}
              title="Cables lower in the list are drawn on top."
              draggable
              onClick={() => select({ type: 'cable', id: cable.id })}
              onMouseEnter={() => setHoverCables([cable.id])}
              onMouseLeave={() => setHoverCables([])}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                setHoverCables([]);
                setDrag({ id: cable.id, from: i, to: i });
              }}
              onDragOver={(e) => {
                if (!drag) return;
                e.preventDefault();
                // The gap before (top half) or after (bottom half) this item, as an index once the cable is moved.
                const box = e.currentTarget.getBoundingClientRect();
                const gap = e.clientY > box.top + box.height / 2 ? i + 1 : i;
                const to = gap > drag.from ? gap - 1 : gap;
                if (to !== drag.to) setDrag({ ...drag, to });
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (drag) moveCable(drag.id, drag.to);
              }}
              onDragEnd={() => setDrag(null)}
            >
              <Icon name="grip" size={14} />
              <ColorDot color={cable.color} />
              <div className="cabname">
                {cable.name}
                <small>{cable.route}</small>
              </div>
              <span>{cable.mm} mm</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">No cables yet.</p>
      )}
    </Section>
  );
}

/** Right panel: the bill of materials and cable list. */
export function InspectorPanel() {
  const doc = useStore((s) => s.doc);
  const routes = routesFor(doc);
  const bom = useMemo(() => billOfMaterials(doc, routes), [doc, routes]);
  const overlapCount = overlapsFor(doc).size;
  return (
    <aside className="panel right">
      <BillOfMaterialsSection bom={bom} overlapCount={overlapCount} />
      <CablesSection bom={bom} />
    </aside>
  );
}
