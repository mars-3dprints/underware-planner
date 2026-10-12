import { CELL_MM, MAX_TURN_SIZE } from '../../domain/constants';
import { patchCable, patchPart } from '../../domain/doc';
import { selectionBounds } from '../../domain/group';
import {
  clampTurnSize,
  COVER_TYPES,
  isLinear,
  isTurn,
  lengthPatch,
  minLength,
  PIECE_LABELS,
} from '../../domain/pieces';
import type { Anchor, Cable, Part } from '../../domain/types';
import type { Route } from '../../routing/route';
import { useShallow } from 'zustand/react/shallow';
import { isGroupSelected, selectedCable, selectedPart, selectionInBom, useStore } from '../../store/store';
import { plural } from '../../ui/plural';
import { NumberField } from './NumberField';
import { PieceButton } from './PieceButton';

function GroupDetails({ parts, cables }: { parts: Part[]; cables: Cable[] }) {
  const box = selectionBounds(parts, cables);
  const counts = [
    parts.length && plural(parts.length, 'object'),
    cables.length && plural(cables.length, 'cable'),
  ];
  return (
    <>
      <div>
        <div className="title">{parts.length + cables.length} items</div>
        <p className="caption">
          {counts.filter(Boolean).join(', ')} · {box.w * CELL_MM} × {box.h * CELL_MM} mm
        </p>
      </div>
      <p className="hint">
        Drag any selected item to move the group. Cable points and loose ends travel with it. Shift-click adds
        or removes items.
      </p>
    </>
  );
}

function PartDetails({ part }: { part: Part }) {
  const commit = useStore((s) => s.commit);
  const edit = (patch: Partial<Part>, key?: string) => commit((d) => patchPart(d, part.id, patch), key);
  const isPiece = part.kind === 'raceway' || part.kind === 'cover';
  const title = part.kind === 'plate' ? 'Tile' : isPiece ? PIECE_LABELS[part.sub!] : 'Object';
  return (
    <>
      <div>
        <div className="title">{title}</div>
        <p className="caption">
          {part.w * CELL_MM} × {part.h * CELL_MM} mm
        </p>
      </div>
      {!isPiece && (
        <label className="field">
          <span>Name</span>
          <input value={part.name} onChange={(e) => edit({ name: e.target.value }, 'n' + part.id)} />
        </label>
      )}
      <div className="row2">
        <NumberField label="X" min={-9999} value={part.x} onChange={(x) => edit({ x }, 'x' + part.id)} />
        <NumberField label="Y" min={-9999} value={part.y} onChange={(y) => edit({ y }, 'y' + part.id)} />
        {!isPiece && (
          <>
            <NumberField label="Rows" value={part.h} onChange={(h) => edit({ h }, 'h' + part.id)} />
            <NumberField label="Columns" value={part.w} onChange={(w) => edit({ w }, 'w' + part.id)} />
          </>
        )}
        {isTurn(part.sub) && (
          <NumberField
            label={`Size (max ${MAX_TURN_SIZE})`}
            value={part.w}
            onChange={(n) => {
              const size = clampTurnSize(n);
              edit({ w: size, h: size }, 'ts' + part.id);
            }}
          />
        )}
        {isLinear(part.sub) && (
          <NumberField
            label="Length (cells)"
            min={minLength(part.sub!)}
            value={Math.max(part.w, part.h)}
            onChange={(n) => edit(lengthPatch(part, n), 'len' + part.id)}
          />
        )}
      </div>
      {part.kind === 'cover' && (
        <div className="tiles">
          {COVER_TYPES.map((sub) => (
            <PieceButton
              key={sub}
              sub={sub}
              active={part.sub === sub}
              onClick={() => edit({ sub, name: PIECE_LABELS[sub] })}
            />
          ))}
        </div>
      )}
    </>
  );
}

function CableDetails({ cable, route }: { cable: Cable; route?: Route }) {
  const doc = useStore((s) => s.doc);
  const commit = useStore((s) => s.commit);
  const edit = (patch: Partial<Cable>, key: string) => commit((d) => patchCable(d, cable.id, patch), key);
  const endName = (end: Anchor) =>
    end.objId === undefined
      ? `loose end (${end.x}, ${end.y})`
      : (doc.objects.find((p) => p.id === end.objId)?.name ?? '?');
  return (
    <>
      <div>
        <div className="title">Cable</div>
        <p className="caption">
          {route ? `${route.mm} mm` : '—'} · {route?.steps ?? 0} cells · {route?.bends ?? 0} bends ·{' '}
          {cable.waypoints.length} points
        </p>
      </div>
      <label className="field">
        <span>Name</span>
        <input value={cable.name} onChange={(e) => edit({ name: e.target.value }, 'cn' + cable.id)} />
      </label>
      <p className="hint">
        {endName(cable.a)} → {endName(cable.b)}. Drag the square handles to move or extend either end.
      </p>
      <NumberField
        label="Extra slack (mm)"
        min={0}
        value={cable.slackMm}
        onChange={(slackMm) => edit({ slackMm }, 'sl' + cable.id)}
      />
    </>
  );
}

/** Includes the selected parts in, or leaves them out of, the bill of materials. */
function BomToggle() {
  const inBom = useStore(selectionInBom);
  const setSelectionInBom = useStore((s) => s.setSelectionInBom);
  if (inBom === undefined) return null;
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={inBom === true}
        ref={(el) => {
          if (el) el.indeterminate = inBom === 'mixed';
        }}
        onChange={() => setSelectionInBom(inBom !== true)}
      />
      <span>Include in bill of materials</span>
    </label>
  );
}

/** Details and fields for the selection. */
export function SelectionSection({ routes }: { routes: Map<string, Route> }) {
  const { doc, selectedIds, selectedCableIds, isGroup, part, cable } = useStore(
    useShallow((s) => ({
      doc: s.doc,
      selectedIds: s.selectedIds,
      selectedCableIds: s.selectedCableIds,
      isGroup: isGroupSelected(s),
      part: selectedPart(s),
      cable: selectedCable(s),
    })),
  );
  if (!isGroup && !part && !cable) return null;
  return (
    <section>
      <h3>Selection</h3>
      {isGroup && (
        <GroupDetails
          parts={doc.objects.filter((p) => selectedIds.includes(p.id))}
          cables={doc.cables.filter((c) => selectedCableIds.includes(c.id))}
        />
      )}
      {part && <PartDetails part={part} />}
      {cable && <CableDetails cable={cable} route={routes.get(cable.id)} />}
      <BomToggle />
    </section>
  );
}
