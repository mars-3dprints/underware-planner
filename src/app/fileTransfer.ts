import type { Doc } from '../domain/types';
import { isDoc } from '../domain/doc';
import { useStore } from '../store/store';
import { fitToContent } from '../store/view';

const EXPORT_VERSION = 1;
const EXPORT_FILENAME = 'underware-layout.json';

/** Downloads the layout as `{ version, doc }` JSON. */
export function exportLayout(doc: Doc) {
  const json = JSON.stringify({ version: EXPORT_VERSION, doc }, null, 2);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  link.download = EXPORT_FILENAME;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Replaces the layout with an exported file (undoable) and frames it. Invalid files are ignored. */
export async function importLayout(file?: File) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!isDoc(data.doc)) return;
    useStore.getState().replaceDoc(data.doc);
    fitToContent();
  } catch {
    // not a layout file
  }
}
