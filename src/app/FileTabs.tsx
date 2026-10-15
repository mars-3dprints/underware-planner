import { useCallback, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isEmptyDoc } from '../domain/doc';
import { fileState, type FileTab, useStore } from '../store/store';
import { fitToContent } from '../store/view';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { useDismiss } from '../ui/useDismiss';

/** Width of the right-click menu. */
const MENU_WIDTH = 200;

/** Asks before closing a file that has something in it. */
function confirmClose(id: string, name: string) {
  const s = useStore.getState();
  return isEmptyDoc(fileState(s, id).doc) || window.confirm(`Close "${name}" and its layout?`);
}

/** Asks before closing every file but `keepId`, when any of them has something in it. */
function confirmCloseOthers(keepId: string) {
  const s = useStore.getState();
  const others = s.files.filter((f) => f.id !== keepId);
  const filled = others.some((f) => !isEmptyDoc(fileState(s, f.id).doc));
  return !filled || window.confirm(`Close ${others.length} other file(s) and their layouts?`);
}

/** Frames a file that is being opened for the first time. */
function framed(action: () => void) {
  action();
  if (!useStore.getState().viewRestored) fitToContent();
}

/** Tabs along the bottom, one per open file: click to open, double-click to rename. */
export function FileTabs() {
  const {
    files,
    activeFileId,
    switchFile,
    addFile,
    renameFile,
    duplicateFile,
    deleteFile,
    closeOtherFiles,
    resetWorkspace,
  } = useStore(
    useShallow((s) => ({
      files: s.files,
      activeFileId: s.activeFileId,
      switchFile: s.switchFile,
      addFile: s.addFile,
      renameFile: s.renameFile,
      duplicateFile: s.duplicateFile,
      deleteFile: s.deleteFile,
      closeOtherFiles: s.closeOtherFiles,
      resetWorkspace: s.resetWorkspace,
    })),
  );
  const [renaming, setRenaming] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dismiss = useCallback(() => setMenu(null), []);
  useDismiss(menuRef, !!menu, dismiss);
  const run = (action: () => void) => {
    setMenu(null);
    action();
  };
  const item = (label: string, action: () => unknown) => (
    <button className="layerrow" role="menuitem" onClick={() => run(() => void action())}>
      {label}
    </button>
  );
  const close = (file: FileTab) =>
    files.length > 1 && confirmClose(file.id, file.name) && framed(() => deleteFile(file.id));
  return (
    <nav className="filetabs" aria-label="Files">
      {files.map((file) => (
        <div key={file.id} className={'filetab' + (file.id === activeFileId ? ' on' : '')}>
          {renaming === file.id ? (
            <input
              autoFocus
              defaultValue={file.name}
              aria-label="File name"
              onFocus={(e) => e.target.select()}
              onBlur={(e) => {
                renameFile(file.id, e.target.value);
                setRenaming(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
                if (e.key === 'Escape') e.currentTarget.value = file.name;
                e.stopPropagation();
              }}
            />
          ) : (
            <button
              className="filename"
              title="Double-click to rename"
              onClick={() => framed(() => switchFile(file.id))}
              onDoubleClick={() => setRenaming(file.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ id: file.id, x: e.clientX, y: e.clientY });
              }}
              onAuxClick={(e) => e.button === 1 && close(file)}
            >
              {file.name}
            </button>
          )}
          {files.length > 1 && (
            <button
              className="fileclose"
              aria-label={`Close ${file.name}`}
              title="Close file"
              onClick={() => close(file)}
            >
              <Icon name="close" size={12} />
            </button>
          )}
        </div>
      ))}
      <IconButton icon="filenew" label="New file" onClick={() => framed(addFile)} />
      {menu && (
        <div
          ref={menuRef}
          className="pop ctxmenu"
          role="menu"
          style={{
            width: MENU_WIDTH,
            left: Math.min(menu.x, window.innerWidth - MENU_WIDTH - 8),
            bottom: window.innerHeight - menu.y,
          }}
        >
          {item('Rename', () => setRenaming(menu.id))}
          {item('Duplicate', () => framed(() => duplicateFile(menu.id)))}
          {files.length > 1 && (
            <>
              {item('Close', () => close(files.find((f) => f.id === menu.id)!))}
              {item(
                'Close other files',
                () => confirmCloseOthers(menu.id) && framed(() => closeOtherFiles(menu.id)),
              )}
            </>
          )}
          {item(
            'Reset workspace',
            () =>
              window.confirm('Close all files and start over with an empty one?') && framed(resetWorkspace),
          )}
        </div>
      )}
    </nav>
  );
}
