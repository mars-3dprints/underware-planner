import { useLayoutEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { canFlip, canSwapStyle, pointEditableCable, selectionInBom, useStore } from '../store/store';
import { fitToContent } from '../store/view';
import { Icon, type IconName } from '../ui/Icon';
import { useDismiss } from '../ui/useDismiss';
import { type SelectionAction, selectionActions } from './selectionActions';

const MARGIN = 8;

/** Right-click menu on the canvas: the selection's actions, or the canvas's when nothing is selected. */
export function SelectionMenu() {
  const menu = useStore((s) => s.selectionMenu);
  return menu && <Menu x={menu.x} y={menu.y} />;
}

interface RowProps {
  label: string;
  icon?: IconName;
  mark?: string;
  shortcut?: string;
  mirrored?: boolean;
  danger?: boolean;
  onSelect: () => void;
}

/** A menu row: icon (or check mark) in its own column, the label, and the shortcut on the right. */
function Row({ label, icon, mark, shortcut, mirrored, danger, onSelect }: RowProps) {
  return (
    <button className={'layerrow ctxrow' + (danger ? ' danger' : '')} role="menuitem" onClick={onSelect}>
      <span className="ctxicon">{icon ? <Icon name={icon} size={16} mirrored={mirrored} /> : mark}</span>
      <span>{label}</span>
      <kbd>{shortcut}</kbd>
    </button>
  );
}

function Menu({ x, y }: { x: number; y: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useStore((s) => s.closeSelectionMenu);
  useDismiss(ref, true, close);
  const { hasSelection, flippable, swappable, inBom, cable, activeWaypoint, canPaste } = useStore(
    useShallow((s) => ({
      hasSelection: !!s.selection,
      flippable: canFlip(s),
      swappable: canSwapStyle(s),
      inBom: selectionInBom(s),
      cable: pointEditableCable(s),
      activeWaypoint: s.activeWaypoint,
      canPaste: !!s.clipboard,
    })),
  );

  // Keep the menu inside the window, whichever edge the pointer is near.
  useLayoutEffect(() => {
    const el = ref.current!;
    const box = el.getBoundingClientRect();
    el.style.left = `${Math.max(MARGIN, Math.min(x, innerWidth - box.width - MARGIN))}px`;
    el.style.top = `${Math.max(MARGIN, Math.min(y, innerHeight - box.height - MARGIN))}px`;
  }, [x, y]);

  // Closes the menu first, so the action never runs under it.
  const pick = (run: () => void) => () => {
    close();
    run();
  };
  const actionRow = (a: SelectionAction) => (
    <Row
      key={a.id}
      label={a.label}
      icon={a.icon}
      mirrored={a.mirrored}
      shortcut={a.shortcut}
      danger={a.danger}
      onSelect={pick(a.run)}
    />
  );
  const actions = selectionActions({ flippable, swappable, cable, activeWaypoint }).filter(
    (a) => a.visible && a.enabled,
  );
  const group = (ids: string[]) => actions.filter((a) => ids.includes(a.id)).map(actionRow);

  return (
    <div ref={ref} className="pop ctxmenu" role="menu">
      {hasSelection ? (
        <>
          {group(['rotate', 'rotateCcw', 'swap', 'flip'])}
          <div className="ctxsep" />
          {group(['copy', 'duplicate', 'deletePoint', 'resetRoute'])}
          <div className="ctxsep" />
          {inBom !== undefined && (
            <Row
              label="Include in bill of materials"
              mark={inBom === true ? '✓' : inBom === 'mixed' ? '–' : undefined}
              onSelect={pick(() => useStore.getState().setSelectionInBom(inBom !== true))}
            />
          )}
          {group(['delete'])}
        </>
      ) : (
        <>
          {canPaste && (
            <Row
              icon="paste"
              label="Paste"
              shortcut="Ctrl+V"
              onSelect={pick(() => useStore.getState().pasteAt(null))}
            />
          )}
          <Row
            icon="selectall"
            label="Select all"
            shortcut="Ctrl+A"
            onSelect={pick(() => useStore.getState().selectAll())}
          />
          <Row icon="fit" label="Fit to content" shortcut="0" onSelect={pick(fitToContent)} />
        </>
      )}
    </div>
  );
}
