import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { isEmptyDoc } from '../domain/doc';
import { type FileTab, useStore } from '../store/store';
import { fitToContent } from '../store/view';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';

/** Asks before closing a file that has something in it. */
function confirmClose(id: string, name: string) {
  const s = useStore.getState();
  const doc = id === s.activeFileId ? s.doc : s.parked[id].doc;
  return isEmptyDoc(doc) || window.confirm(`Close "${name}" and its layout?`);
}

/** Frames a file that is being opened for the first time. */
function framed(action: () => void) {
  action();
  if (!useStore.getState().viewRestored) fitToContent();
}

/** Tabs along the bottom, one per open file: click to open, double-click to rename. */
export function FileTabs() {
  const { files, activeFileId, switchFile, addFile, renameFile, deleteFile } = useStore(
    useShallow((s) => ({
      files: s.files,
      activeFileId: s.activeFileId,
      switchFile: s.switchFile,
      addFile: s.addFile,
      renameFile: s.renameFile,
      deleteFile: s.deleteFile,
    })),
  );
  const [renaming, setRenaming] = useState<string | null>(null);
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
    </nav>
  );
}
