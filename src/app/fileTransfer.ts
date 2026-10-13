import type { Doc } from '../domain/types';
import { readLayout } from '../domain/migrate';
import { isEmptyDoc } from '../domain/doc';
import { activeFileName, useStore } from '../store/store';
import { fitToContent } from '../store/view';

const EXPORT_VERSION = 1;
/** Downloads the layout as `{ version, doc }` JSON, named after its file. */
export function exportLayout(doc: Doc, name: string) {
  const json = JSON.stringify({ version: EXPORT_VERSION, doc }, null, 2);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  link.download = `${name.replace(/[\\/:*?"<>|]/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Replaces the active file's layout with an exported file (undoable, migrated like a save) and frames it, after
 * confirming when there is something to replace. Invalid files are ignored.
 */
export async function importLayout(file?: File) {
  if (!file) return;
  try {
    const doc = readLayout(JSON.parse(await file.text())?.doc);
    if (!doc) return;
    const s = useStore.getState();
    const replace = `Replace "${activeFileName(s)}" with the imported layout? You can undo this.`;
    if (!isEmptyDoc(s.doc) && !window.confirm(replace)) return;
    s.replaceDoc(doc);
    fitToContent();
  } catch {
    // not a layout file
  }
}
