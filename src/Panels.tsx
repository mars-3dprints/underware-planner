import { useEffect, useMemo, useRef, useState } from 'react';
import { patchCable, patchObject, useStore } from './store';
import { computeRoutes } from './route';
import { findOverlaps, summarize, summaryText } from './summary';
import type { Anchor, Sub } from './types';
import { boxOfAll } from './group';
import {
  ADDON_LABEL,
  CELL_MM,
  COLORS,
  MAX_TURN,
  PLATE_DEFAULT,
  counterpart,
  isShaped,
  isTurn,
  labelOf,
  lenPatch,
} from './types';
import { PieceThumb } from './Thumb';

function Num({
  label,
  value,
  min = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (n: number) => void;
}) {
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
export function Swatches({
  value,
  onChange,
  extra = [],
}: {
  value: string;
  onChange: (c: string) => void;
  extra?: string[];
}) {
  const palette = useStore((s) => s.palette),
    addColor = useStore((s) => s.addColor),
    removeColor = useStore((s) => s.removeColor);
  const ref = useRef<HTMLInputElement>(null),
    cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    // 'change' fires once when the colour dialog is confirmed, so dragging inside it adds nothing
    const el = ref.current;
    if (!el) return;
    const h = () => {
      addColor(el.value);
      cb.current(el.value.toLowerCase());
    };
    el.addEventListener('change', h);
    return () => el.removeEventListener('change', h);
  }, [addColor]);
  return (
    <div className="swatches">
      {extra.map((c) => (
        <button
          key={c}
          className={'sw' + (c === value ? ' on' : '')}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={c}
        />
      ))}
      {COLORS.map((c) => (
        <button
          key={c}
          className={'sw' + (c === value ? ' on' : '')}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={c}
        />
      ))}
      {palette.map((c) => (
        <span key={c} className="swwrap">
          <button
            className={'sw' + (c === value ? ' on' : '')}
            style={{ background: c }}
            onClick={() => onChange(c)}
            aria-label={c}
          />
          {
            <button
              className="swx"
              onClick={() => removeColor(c)}
              aria-label={`Remove ${c}`}
              title="Remove colour"
            >
              ×
            </button>
          }
        </span>
      ))}
      <label className="sw picker" title="Add colour">
        <input
          ref={ref}
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

const PRESETS: [string, number, number][] = [
  ['Router', 2, 1],
  ['Switch', 2, 1],
  ['Power strip', 3, 1],
  ['NAS', 1, 2],
  ['Charger', 1, 1],
  ['UPS', 3, 2],
  ['PC', 2, 4],
  ['Monitor', 6, 4],
  ['Speaker', 2, 3],
  ['3D printer', 7, 7],
];
const COVERS: Sub[] = ['hole', 'wall'];
const fixedShape = isShaped;
const TURN_PRESETS = [1, 2, 3, 4, 5];
function Tile({
  sub,
  len,
  flip,
  active,
  onClick,
}: {
  sub: Sub;
  len?: number;
  flip?: boolean;
  active: boolean;
  onClick: () => void;
}) {
  const label = isTurn(sub) ? `${ADDON_LABEL[sub]} ${len}×${len}` : labelOf(sub, !!flip);
  return (
    <button className={'tile' + (active ? ' on' : '')} onClick={onClick} title={label} aria-label={label}>
      <PieceThumb sub={sub} len={len} flip={flip} />
    </button>
  );
}

type TileSpec = { sub: Sub; flip?: boolean };
const CHANNEL_GROUPS: { title: string; tiles: TileSpec[] }[] = [
  { title: 'Straight', tiles: [{ sub: 'straight' }, { sub: 'bridge' }] },
  { title: 'Turns', tiles: [{ sub: 'turn' }, { sub: 'angled' }, { sub: 'cap' }] },
  {
    title: 'Merge and branch',
    tiles: [
      { sub: 'y_round' },
      { sub: 'y_round', flip: true },
      { sub: 'y_angled' },
      { sub: 'y_angled', flip: true },
    ],
  },
  {
    title: 'Junctions',
    tiles: ['t', 'cross1', 'cross', 'fork_round', 'fork_angled'].map((sub) => ({ sub: sub as Sub })),
  },
  {
    title: 'Offsets',
    tiles: [
      { sub: 'jog_round' },
      { sub: 'jog_round', flip: true },
      { sub: 'jog_angled' },
      { sub: 'jog_angled', flip: true },
    ],
  },
];

export function LeftPanel() {
  const st = useStore();
  const [rows, setRows] = useState(4),
    [cols, setCols] = useState(4),
    [len, setLen] = useState(5),
    [turnN, setTurnN] = useState(3);
  const [name, setName] = useState('Router'),
    [w, setW] = useState(2),
    [h, setH] = useState(1),
    [color, setColor] = useState(COLORS[4]);
  const active = st.tool === 'place' ? st.stamp?.sub : undefined;
  const placing =
    st.tool === 'place'
      ? st.block
        ? `${st.block.name} ${st.block.h}×${st.block.w}`
        : st.stamp
          ? ADDON_LABEL[st.stamp.sub]
          : ''
      : '';
  const tiles = (g: { tiles: TileSpec[] }) =>
    g.tiles.flatMap(({ sub: s, flip }) =>
      isTurn(s)
        ? TURN_PRESETS.filter((n) => s === 'turn' || n > 1).map((n) => (
            <Tile
              key={s + n}
              sub={s}
              len={n}
              active={active === s && st.stamp?.len === n}
              onClick={() => {
                setTurnN(n);
                if (st.stamp?.sub === s) st.resizeStamp(n);
                else st.setStamp(s, n);
              }}
            />
          ))
        : [
            <Tile
              key={s + (flip ? 'm' : '')}
              sub={s}
              len={len}
              flip={flip}
              active={active === s && !!st.stamp?.flip === !!flip}
              onClick={() => st.setStamp(s, len, !!flip)}
            />,
          ],
    );
  return (
    <aside className="panel left">
      {placing && (
        <div className="status">
          <b>Placing {placing}</b>
          <span>
            Click to place · R rotate{st.stamp && fixedShape(st.stamp.sub) ? ' · F flip' : ''}
            {st.stamp && counterpart(st.stamp.sub, st.stamp.len) ? ' · T rounded/angled' : ''}
            {st.stamp && COVERS.includes(st.stamp.sub) ? ' · drag to paint' : ''} · Esc stop
          </span>
        </div>
      )}
      <section>
        <h3>Tile</h3>
        <div className="row2">
          <Num
            label="Rows"
            value={rows}
            onChange={(n) => {
              setRows(n);
              st.patchBlock('plate', { h: n });
            }}
          />
          <Num
            label="Columns"
            value={cols}
            onChange={(n) => {
              setCols(n);
              st.patchBlock('plate', { w: n });
            }}
          />
        </div>
        <p className="hint">
          {cols * CELL_MM} × {rows * CELL_MM} mm
        </p>
        <button
          className={'btn block' + (st.block?.kind === 'plate' ? ' on' : ' primary')}
          onClick={() => st.setBlock({ kind: 'plate', name: 'Tile', w: cols, h: rows, color: PLATE_DEFAULT })}
        >
          Add tile
        </button>
      </section>
      <section>
        <h3>Tile covers</h3>
        <div className="tiles">
          {COVERS.map((s) => (
            <Tile key={s} sub={s} active={active === s} onClick={() => st.setStamp(s, 1)} />
          ))}
        </div>
        <p className="hint">Tile holes stay open until a cover is placed.</p>
      </section>
      <section>
        <h3>Channels</h3>
        {CHANNEL_GROUPS.map((g) => (
          <div className="group" key={g.title}>
            <span className="sub">{g.title}</span>
            {g.title === 'Straight' && (
              <Num
                label="Length (cells)"
                value={len}
                onChange={(n) => {
                  setLen(n);
                  if (st.stamp && (st.stamp.sub === 'straight' || st.stamp.sub === 'bridge'))
                    st.resizeStamp(n);
                }}
              />
            )}
            {g.title === 'Turns' && (
              <Num
                label={`Size (cells, max ${MAX_TURN})`}
                value={turnN}
                onChange={(n) => {
                  const k = Math.min(MAX_TURN, n);
                  setTurnN(k);
                  if (st.stamp && isTurn(st.stamp.sub)) st.resizeStamp(k);
                  else st.setStamp('turn', k);
                }}
              />
            )}
            <div className="tiles">{tiles(g)}</div>
            {g.title === 'Straight' && (
              <p className="hint">
                {len} cells = {len * CELL_MM} mm. Bridges are at least 3 cells and pass over other channels.
              </p>
            )}
          </div>
        ))}
      </section>
      <section>
        <h3>Custom object</h3>
        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              st.patchBlock('object', { name: e.target.value || 'Object' });
            }}
          />
        </label>
        <div className="chips">
          {PRESETS.map(([n, pw, ph]) => (
            <button
              key={n}
              className="chip"
              onClick={() => {
                setName(n);
                setW(pw);
                setH(ph);
                st.patchBlock('object', { name: n, w: pw, h: ph });
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="row2">
          <Num
            label="Columns"
            value={w}
            onChange={(n) => {
              setW(n);
              st.patchBlock('object', { w: n });
            }}
          />
          <Num
            label="Rows"
            value={h}
            onChange={(n) => {
              setH(n);
              st.patchBlock('object', { h: n });
            }}
          />
        </div>
        <Swatches
          value={color}
          onChange={(c) => {
            setColor(c);
            st.patchBlock('object', { color: c });
          }}
        />
        <button
          className={'btn block' + (st.block?.kind === 'object' ? ' on' : ' primary')}
          onClick={() => st.setBlock({ kind: 'object', name: name || 'Object', w, h, color })}
        >
          Add object
        </button>
      </section>
    </aside>
  );
}

export function RightPanel() {
  const { doc, sel, wp, commit, select, ids, cids } = useStore();
  const multiObjs = doc.objects.filter((q) => ids.includes(q.id)),
    multiCables = doc.cables.filter((q) => cids.includes(q.id));
  const isMulti = ids.length + cids.length > 1;
  const routes = useMemo(() => computeRoutes(doc), [doc]);
  const sum = useMemo(() => summarize(doc, routes), [doc, routes]);
  const overlapCount = useMemo(() => findOverlaps(doc).size, [doc]);
  const o = sel?.type === 'obj' && !isMulti ? doc.objects.find((q) => q.id === sel.id) : undefined;
  const c = sel?.type === 'cable' && !isMulti ? doc.cables.find((q) => q.id === sel.id) : undefined;
  const r = c ? routes.get(c.id) : undefined;
  const endName = (a: Anchor) =>
    a.objId === undefined
      ? `loose end (${a.x}, ${a.y})`
      : (doc.objects.find((q) => q.id === a.objId)?.name ?? '?');
  const st = useStore.getState;
  const [copied, setCopied] = useState(false);
  const addon = o && (o.kind === 'raceway' || o.kind === 'cover');
  const linear = o && (o.sub === 'straight' || o.sub === 'bridge');
  const turnSel = isTurn(o?.sub);

  const count = ids.length + cids.length;
  const kv = (k: string, v: string | number) => (
    <div className="kv">
      <span>{k}</span>
      <b>{v}</b>
    </div>
  );
  const covers = sum.addons.filter((a) => COVERS.includes(a.sub)),
    channels = sum.addons.filter((a) => !COVERS.includes(a.sub));
  const addonTable = (list: typeof sum.addons) => (
    <table className="tbl">
      <thead>
        <tr>
          <th></th>
          <th>Item</th>
          <th className="r">Qty</th>
        </tr>
      </thead>
      <tbody>
        {list.map((a) => (
          <tr key={a.label + a.spec}>
            <td className="thumbcell">
              <PieceThumb sub={a.sub} len={a.len} size={30} flip={a.mirrored} />
            </td>
            <td>
              {a.label}
              <small className="spec">{a.spec}</small>
            </td>
            <td className="r">{a.qty}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <aside className="panel right">
      {(isMulti || o || c) && (
        <section>
          <h3>Selection</h3>
          {isMulti &&
            (() => {
              const b = boxOfAll(multiObjs, multiCables);
              return (
                <>
                  <div>
                    <div className="title">{count} items</div>
                    <p className="caption">
                      {[
                        ids.length && `${ids.length} object${ids.length > 1 ? 's' : ''}`,
                        cids.length && `${cids.length} cable${cids.length > 1 ? 's' : ''}`,
                      ]
                        .filter(Boolean)
                        .join(', ')}{' '}
                      · {b.w * CELL_MM} × {b.h * CELL_MM} mm
                    </p>
                  </div>
                  <p className="hint">
                    Drag any selected item to move the group. Cable points and loose ends travel with it.
                    Shift-click adds or removes items.
                  </p>
                </>
              );
            })()}
          {o && (
            <>
              <div>
                <div className="title">
                  {o.kind === 'plate' ? 'Tile' : addon ? ADDON_LABEL[o.sub!] : 'Object'}
                </div>
                <p className="caption">
                  {o.w * CELL_MM} × {o.h * CELL_MM} mm
                </p>
              </div>
              {!addon && (
                <label className="field">
                  <span>Name</span>
                  <input
                    value={o.name}
                    onChange={(e) =>
                      commit((d) => patchObject(d, o.id, { name: e.target.value }), 'n' + o.id)
                    }
                  />
                </label>
              )}
              <div className="row2">
                <Num
                  label="X"
                  min={-9999}
                  value={o.x}
                  onChange={(n) => commit((d) => patchObject(d, o.id, { x: n }), 'x' + o.id)}
                />
                <Num
                  label="Y"
                  min={-9999}
                  value={o.y}
                  onChange={(n) => commit((d) => patchObject(d, o.id, { y: n }), 'y' + o.id)}
                />
                {!addon && (
                  <>
                    <Num
                      label="Rows"
                      value={o.h}
                      onChange={(n) => commit((d) => patchObject(d, o.id, { h: n }), 'h' + o.id)}
                    />
                    <Num
                      label="Columns"
                      value={o.w}
                      onChange={(n) => commit((d) => patchObject(d, o.id, { w: n }), 'w' + o.id)}
                    />
                  </>
                )}
                {turnSel && (
                  <Num
                    label={`Size (max ${MAX_TURN})`}
                    value={o.w}
                    onChange={(n) => {
                      const k = Math.min(MAX_TURN, n);
                      commit((d) => patchObject(d, o.id, { w: k, h: k }), 'ts' + o.id);
                    }}
                  />
                )}
                {linear && (
                  <Num
                    label="Length (cells)"
                    min={o.sub === 'bridge' ? 3 : 1}
                    value={Math.max(o.w, o.h)}
                    onChange={(n) => commit((d) => patchObject(d, o.id, lenPatch(o, n)), 'len' + o.id)}
                  />
                )}
              </div>
              {o.kind === 'cover' && (
                <div className="tiles">
                  {COVERS.map((s) => (
                    <Tile
                      key={s}
                      sub={s}
                      active={o.sub === s}
                      onClick={() => commit((d) => patchObject(d, o.id, { sub: s, name: ADDON_LABEL[s] }))}
                    />
                  ))}
                </div>
              )}
            </>
          )}
          {c && (
            <>
              <div>
                <div className="title">Cable</div>
                <p className="caption">
                  {r ? `${r.mm} mm` : '—'} · {r?.steps ?? 0} cells · {r?.bends ?? 0} bends ·{' '}
                  {c.waypoints.length} points
                </p>
              </div>
              <label className="field">
                <span>Name</span>
                <input
                  value={c.name}
                  onChange={(e) => commit((d) => patchCable(d, c.id, { name: e.target.value }), 'cn' + c.id)}
                />
              </label>
              <p className="hint">
                {endName(c.a)} → {endName(c.b)}. Drag the square handles to move or extend either end.
              </p>
              <Num
                label="Extra slack (mm)"
                min={0}
                value={c.slackMm}
                onChange={(n) => commit((d) => patchCable(d, c.id, { slackMm: n }), 'sl' + c.id)}
              />
            </>
          )}
        </section>
      )}
      <section>
        <h3>
          Bill of materials{' '}
          <button
            className="btn sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(summaryText(sum));
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                /* ignore */
              }
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </h3>
        {overlapCount > 0 && (
          <p className="warn">{overlapCount} overlapping item(s), shown with a dashed red outline.</p>
        )}
        <div className="group">
          <span className="sub">Tiles</span>
          {sum.sizes.length ? (
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
                  {sum.sizes.map((z) => (
                    <tr key={z.rows + 'x' + z.cols}>
                      <td>
                        {z.rows} × {z.cols}
                      </td>
                      <td>
                        {z.rows * CELL_MM}×{z.cols * CELL_MM}
                      </td>
                      <td className="r">{z.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {kv('Total tiles', sum.plates)}
              {kv('Total cells (28 mm each)', sum.tiles)}
              {kv('Connectors', sum.connectors)}
              {sum.bboxMm && kv('Footprint', `${sum.bboxMm.w} × ${sum.bboxMm.h} mm`)}
            </>
          ) : (
            <p className="hint">No tiles yet.</p>
          )}
        </div>
        <div className="group">
          <span className="sub">Channels</span>
          {channels.length ? (
            <>
              {addonTable(channels)}
              {kv(
                'Total channels',
                channels.reduce((n, a) => n + a.qty, 0),
              )}
            </>
          ) : (
            <p className="hint">No channels yet.</p>
          )}
        </div>
        {covers.length > 0 && (
          <div className="group">
            <span className="sub">Tile covers</span>
            {addonTable(covers)}
            {kv(
              'Total covers',
              covers.reduce((n, a) => n + a.qty, 0),
            )}
          </div>
        )}
        {kv('Objects', sum.objects)}
      </section>
      <section>
        <h3>
          Cables <small>{(sum.cableMm / 1000).toFixed(2)} m total</small>
        </h3>
        {sum.cables.length ? (
          <ul className="list">
            {sum.cables.map((x) => (
              <li
                key={x.id}
                className={cids.includes(x.id) ? 'on' : ''}
                onClick={() => select({ type: 'cable', id: x.id })}
              >
                <i style={{ background: x.color }} />
                {x.name}
                <span>{x.mm} mm</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">No cables yet.</p>
        )}
      </section>
    </aside>
  );
}
