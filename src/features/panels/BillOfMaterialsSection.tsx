import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { type BillOfMaterials, billOfMaterialsText, type PieceLine } from '../../bom/billOfMaterials';
import { CELL_MM } from '../../domain/constants';
import { layerOf } from '../../domain/layers';
import { channelLabel } from '../../domain/pieces';
import { useStore } from '../../store/store';
import { ColorDot } from '../../ui/ColorDot';
import { PieceThumb } from '../../ui/PieceThumb';
import { plural } from '../../ui/plural';

const COPIED_MS = 1500;

function KeyValue({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="kv">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

/** Row props for a line of parts: click selects them on the canvas, hover highlights them. */
function useLineFocus() {
  const { selectedIds, selectItems, setHoverParts } = useStore(
    useShallow((s) => ({
      selectedIds: s.selectedIds,
      selectItems: s.selectItems,
      setHoverParts: s.setHoverParts,
    })),
  );
  return (ids: string[]) => ({
    className: 'pick' + (ids.length && ids.every((id) => selectedIds.includes(id)) ? ' on' : ''),
    onClick: () => {
      const { doc, hidden } = useStore.getState();
      const visible = new Set(doc.objects.filter((p) => !hidden[layerOf(p)]).map((p) => p.id));
      selectItems(ids.filter((id) => visible.has(id)));
    },
    onMouseEnter: () => setHoverParts(ids),
    onMouseLeave: () => setHoverParts([]),
  });
}

function PieceTable({ lines }: { lines: PieceLine[] }) {
  const focus = useLineFocus();
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th></th>
          <th>Item</th>
          <th className="r">Qty</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.key} {...focus(line.ids)}>
            <td className="thumbcell">
              <div>
                <ColorDot color={line.color} />
                <PieceThumb sub={line.sub} len={line.len} size={30} flip={line.mirrored} />
              </div>
            </td>
            <td>
              {channelLabel(line.label)}
              <small className="spec">{line.spec}</small>
            </td>
            <td className="r">{line.qty}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const total = (lines: PieceLine[]) => lines.reduce((n, line) => n + line.qty, 0);

function CopyButton({ bom }: { bom: BillOfMaterials }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(billOfMaterialsText(bom));
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      // clipboard unavailable
    }
  };
  return (
    <button className="btn sm" onClick={copy}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function BillOfMaterialsSection({
  bom,
  overlapCount,
}: {
  bom: BillOfMaterials;
  overlapCount: number;
}) {
  const { channels, snaps } = bom;
  const focus = useLineFocus();
  return (
    <section>
      <h3>
        Bill of materials <CopyButton bom={bom} />
      </h3>
      {overlapCount > 0 && (
        <p className="warn">{overlapCount} overlapping item(s), shown with a dashed red outline.</p>
      )}
      <div className="group">
        <span className="sub">Tiles</span>
        {bom.sizes.length ? (
          <>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Size (rows × cols)</th>
                  <th>mm</th>
                  <th className="r">Qty</th>
                </tr>
              </thead>
              <tbody>
                {bom.sizes.map((size) => (
                  <tr key={size.key} {...focus(size.ids)}>
                    <td>
                      <ColorDot color={size.color} />
                      {size.rows} × {size.cols}
                    </td>
                    <td>
                      {size.rows * CELL_MM}×{size.cols * CELL_MM}
                    </td>
                    <td className="r">{size.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <KeyValue label="Total tiles" value={bom.plates} />
            <KeyValue label="Total cells (28 mm each)" value={bom.tiles} />
            <KeyValue label="Connectors" value={bom.connectors} />
            {bom.bboxMm && <KeyValue label="Footprint" value={`${bom.bboxMm.w} × ${bom.bboxMm.h} mm`} />}
          </>
        ) : (
          <p className="hint">No tiles yet.</p>
        )}
      </div>
      <div className="group">
        <span className="sub">Channels</span>
        {channels.length ? (
          <>
            <PieceTable lines={channels} />
            <KeyValue label="Total channels" value={total(channels)} />
          </>
        ) : (
          <p className="hint">No channels yet.</p>
        )}
      </div>
      {snaps.length > 0 && (
        <div className="group">
          <span className="sub">Snaps</span>
          <PieceTable lines={snaps} />
          <KeyValue label="Total snaps" value={total(snaps)} />
        </div>
      )}
      {bom.excluded > 0 && (
        <p className="hint">{plural(bom.excluded, 'excluded part')} (shown faded) not counted.</p>
      )}
    </section>
  );
}
