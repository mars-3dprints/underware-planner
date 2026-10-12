import { useMemo } from 'react';
import { billOfMaterials, type BillOfMaterials } from '../../bom/billOfMaterials';
import { overlapsFor } from '../../bom/overlaps';
import { routesFor } from '../../routing/route';
import { useStore } from '../../store/store';
import { BillOfMaterialsSection } from './BillOfMaterialsSection';
import { SelectionSection } from './SelectionSection';

function CablesSection({ bom }: { bom: BillOfMaterials }) {
  const selectedCableIds = useStore((s) => s.selectedCableIds);
  const select = useStore((s) => s.select);
  const setHoverCables = useStore((s) => s.setHoverCables);
  return (
    <section>
      <h3>
        Cables <small>{(bom.cableMm / 1000).toFixed(2)} m total</small>
      </h3>
      {bom.cables.length ? (
        <ul className="list">
          {bom.cables.map((cable) => (
            <li
              key={cable.id}
              className={selectedCableIds.includes(cable.id) ? 'on' : ''}
              onClick={() => select({ type: 'cable', id: cable.id })}
              onMouseEnter={() => setHoverCables([cable.id])}
              onMouseLeave={() => setHoverCables([])}
            >
              <i style={{ background: cable.color }} />
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
    </section>
  );
}

/** Right panel: the selection, bill of materials and cable list. */
export function InspectorPanel() {
  const doc = useStore((s) => s.doc);
  const routes = routesFor(doc);
  const bom = useMemo(() => billOfMaterials(doc, routes), [doc, routes]);
  const overlapCount = overlapsFor(doc).size;
  return (
    <aside className="panel right">
      <SelectionSection routes={routes} />
      <BillOfMaterialsSection bom={bom} overlapCount={overlapCount} />
      <CablesSection bom={bom} />
    </aside>
  );
}
