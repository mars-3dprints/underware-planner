import type { Cable } from '../domain/types';
import { useStore } from '../store/store';
import type { IconName } from '../ui/Icon';

/** One selection action, shared by the selection toolbar and the right-click menu. */
export interface SelectionAction {
  id: string;
  label: string;
  icon: IconName;
  shortcut?: string;
  mirrored?: boolean;
  danger?: boolean;
  /** Offered for this selection at all. */
  visible: boolean;
  /** Usable right now. The toolbar greys out the rest; the menu leaves them out. */
  enabled: boolean;
  run(): void;
}

export interface ActionContext {
  flippable: boolean;
  swappable: boolean;
  cable: Cable | undefined;
  activeWaypoint: number | null;
}

/** The selection's actions, in toolbar order. */
export function selectionActions(c: ActionContext): SelectionAction[] {
  const s = () => useStore.getState();
  return [
    {
      id: 'rotate',
      label: 'Rotate clockwise',
      icon: 'rotate',
      shortcut: 'R',
      visible: true,
      enabled: true,
      run: () => s().rotateSelection(),
    },
    {
      id: 'rotateCcw',
      label: 'Rotate counter-clockwise',
      icon: 'rotate',
      shortcut: 'Shift+R',
      mirrored: true,
      visible: true,
      enabled: true,
      run: () => s().rotateSelection(true),
    },
    {
      id: 'swap',
      label: 'Rounded / angled',
      icon: 'style',
      shortcut: 'T',
      visible: c.swappable,
      enabled: true,
      run: () => s().swapStyle(),
    },
    {
      id: 'flip',
      label: 'Flip',
      icon: 'flip',
      shortcut: 'F',
      visible: c.flippable,
      enabled: true,
      run: () => s().flipSelection(),
    },
    {
      id: 'copy',
      label: 'Copy',
      icon: 'copy',
      shortcut: 'Ctrl+C',
      visible: true,
      enabled: true,
      run: () => s().copySelection(),
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: 'duplicate',
      shortcut: 'Ctrl+D',
      visible: true,
      enabled: true,
      run: () => s().duplicateSelection(),
    },
    {
      id: 'deletePoint',
      label: 'Delete point',
      icon: 'delpoint',
      visible: !!c.cable,
      enabled: c.activeWaypoint !== null,
      run: () => s().deleteSelection(),
    },
    {
      id: 'resetRoute',
      label: 'Reset route',
      icon: 'reset',
      visible: !!c.cable,
      enabled: !!c.cable?.waypoints.length,
      run: () => c.cable && s().resetCableRoute(c.cable.id),
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: 'trash',
      shortcut: 'Del',
      danger: true,
      visible: true,
      enabled: true,
      run: () => s().deleteSelection(),
    },
  ];
}
