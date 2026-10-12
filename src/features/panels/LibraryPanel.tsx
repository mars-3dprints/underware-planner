import { useState } from 'react';
import { CELL_MM, DEFAULT_COLORS, MAX_TURN_SIZE, TILE_COLOR, TILE_LABEL } from '../../domain/constants';
import {
  clampTurnSize,
  counterpart,
  SNAP_TYPES,
  isLinear,
  isShaped,
  isSmallTurn,
  isTurn,
  pieceLabel,
} from '../../domain/pieces';
import type { PieceType } from '../../domain/types';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../../store/store';
import { Swatches } from '../../ui/Swatches';
import { type ChannelGroup, CHANNEL_GROUPS, DEVICE_PRESETS, TURN_SIZES } from './catalog';
import { NumberField } from './NumberField';
import { PieceButton } from './PieceButton';

/** What is being placed, with the keys that apply to it. */
function PlacingStatus() {
  const { tool, block, stamp } = useStore(
    useShallow((s) => ({ tool: s.tool, block: s.block, stamp: s.stamp })),
  );
  if (tool !== 'place') return null;
  const label = block
    ? `${block.name} ${block.h}×${block.w}`
    : stamp
      ? pieceLabel(stamp.sub, { size: stamp.len })
      : '';
  if (!label) return null;
  const hints = [
    'Click to place',
    'R rotate',
    stamp && isShaped(stamp.sub) && 'F flip',
    stamp && counterpart(stamp.sub, stamp.len) && 'T rounded/angled',
    stamp && SNAP_TYPES.includes(stamp.sub) && 'drag to paint',
    'Esc stop',
  ];
  return (
    <div className="status">
      <b>Placing {label}</b>
      <span>{hints.filter(Boolean).join(' · ')}</span>
    </div>
  );
}

function TileSection() {
  const block = useStore((s) => s.block);
  const setBlock = useStore((s) => s.setBlock);
  const patchBlock = useStore((s) => s.patchBlock);
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(4);
  return (
    <section>
      <h3>Tiles</h3>
      <div className="row2">
        <NumberField
          label="Rows"
          value={rows}
          onChange={(n) => {
            setRows(n);
            patchBlock('plate', { h: n });
          }}
        />
        <NumberField
          label="Columns"
          value={cols}
          onChange={(n) => {
            setCols(n);
            patchBlock('plate', { w: n });
          }}
        />
      </div>
      <p className="hint">
        {cols * CELL_MM} × {rows * CELL_MM} mm
      </p>
      <button
        className={'btn block' + (block?.kind === 'plate' ? ' on' : ' primary')}
        onClick={() => setBlock({ kind: 'plate', name: TILE_LABEL, w: cols, h: rows, color: TILE_COLOR })}
      >
        Add tile
      </button>
    </section>
  );
}

function SnapSection({ active }: { active?: PieceType }) {
  const setStamp = useStore((s) => s.setStamp);
  return (
    <section>
      <h3>Snaps</h3>
      <div className="tiles">
        {SNAP_TYPES.map((sub) => (
          <PieceButton key={sub} sub={sub} active={active === sub} onClick={() => setStamp(sub, 1)} />
        ))}
      </div>
      <p className="hint">Tile holes stay open until a snap is placed.</p>
    </section>
  );
}

function ChannelSection({ active }: { active?: PieceType }) {
  const { stamp, setStamp, resizeStamp } = useStore(
    useShallow((s) => ({ stamp: s.stamp, setStamp: s.setStamp, resizeStamp: s.resizeStamp })),
  );
  const [length, setLength] = useState(5);
  const [turnSize, setTurnSize] = useState(3);

  const buttons = (group: ChannelGroup) =>
    group.entries.flatMap(({ sub, flip }) =>
      isTurn(sub)
        ? TURN_SIZES.filter((n) => sub === 'turn' || !isSmallTurn(sub, n)).map((n) => (
            <PieceButton
              key={sub + n}
              sub={sub}
              len={n}
              active={active === sub && stamp?.len === n}
              onClick={() => {
                setTurnSize(n);
                if (stamp?.sub === sub) resizeStamp(n);
                else setStamp(sub, n);
              }}
            />
          ))
        : [
            <PieceButton
              key={sub + (flip ? 'm' : '')}
              sub={sub}
              len={length}
              flip={flip}
              active={active === sub && !!stamp?.flip === !!flip}
              onClick={() => setStamp(sub, length, !!flip)}
            />,
          ],
    );

  return (
    <section>
      <h3>Channels</h3>
      {CHANNEL_GROUPS.map((group) => (
        <div className="group" key={group.title}>
          <span className="sub">{group.title}</span>
          {group.kind === 'straight' && (
            <NumberField
              label="Length (cells)"
              value={length}
              onChange={(n) => {
                setLength(n);
                if (stamp && isLinear(stamp.sub)) resizeStamp(n);
              }}
            />
          )}
          {group.kind === 'turns' && (
            <NumberField
              label={`Size (cells, max ${MAX_TURN_SIZE})`}
              value={turnSize}
              onChange={(n) => {
                const size = clampTurnSize(n);
                setTurnSize(size);
                if (stamp && isTurn(stamp.sub)) resizeStamp(size);
                else setStamp('turn', size);
              }}
            />
          )}
          <div className="tiles">{buttons(group)}</div>
          {group.kind === 'straight' && (
            <p className="hint">
              {length} cells = {length * CELL_MM} mm. Bridges are at least 3 cells and pass over other
              channels.
            </p>
          )}
        </div>
      ))}
    </section>
  );
}

function DeviceSection() {
  const block = useStore((s) => s.block);
  const setBlock = useStore((s) => s.setBlock);
  const patchBlock = useStore((s) => s.patchBlock);
  const [name, setName] = useState('Router');
  const [w, setW] = useState(2);
  const [h, setH] = useState(1);
  const [color, setColor] = useState(DEFAULT_COLORS[4]);
  return (
    <section>
      <h3>Custom objects</h3>
      <label className="field">
        <span>Name</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            patchBlock('object', { name: e.target.value || 'Object' });
          }}
        />
      </label>
      <div className="chips">
        {DEVICE_PRESETS.map(([preset, pw, ph]) => (
          <button
            key={preset}
            className="chip"
            onClick={() => {
              setName(preset);
              setW(pw);
              setH(ph);
              patchBlock('object', { name: preset, w: pw, h: ph });
            }}
          >
            {preset}
          </button>
        ))}
      </div>
      <div className="row2">
        <NumberField
          label="Columns"
          value={w}
          onChange={(n) => {
            setW(n);
            patchBlock('object', { w: n });
          }}
        />
        <NumberField
          label="Rows"
          value={h}
          onChange={(n) => {
            setH(n);
            patchBlock('object', { h: n });
          }}
        />
      </div>
      <Swatches
        value={color}
        onChange={(c) => {
          setColor(c);
          patchBlock('object', { color: c });
        }}
      />
      <button
        className={'btn block' + (block?.kind === 'object' ? ' on' : ' primary')}
        onClick={() => setBlock({ kind: 'object', name: name || 'Object', w, h, color })}
      >
        Add object
      </button>
    </section>
  );
}

/** Left panel: the parts to place. */
export function LibraryPanel() {
  const tool = useStore((s) => s.tool);
  const placing = useStore((s) => s.stamp?.sub);
  const active = tool === 'place' ? placing : undefined;
  return (
    <aside className="panel left">
      <PlacingStatus />
      {/* Same order as the layers and the bill of materials: tiles, objects, channels, then snaps. */}
      <TileSection />
      <DeviceSection />
      <ChannelSection active={active} />
      <SnapSection active={active} />
    </aside>
  );
}
