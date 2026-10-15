import { DEFAULT_COLORS } from '../domain/constants';
import { readLayout } from '../domain/migrate';
import { sampleDoc } from '../domain/sample';
import { uid } from '../domain/id';
import type { Doc, View } from '../domain/types';

export const STORAGE_KEY = 'underware-planner-v1';
const SAVE_DELAY_MS = 300;

export interface SavedFile {
  id: string;
  name: string;
  doc: Doc;
  view: View | null;
}

interface Saved {
  /** The open files, in tab order. Never empty. */
  files: SavedFile[];
  activeId: string;
  /** Custom swatches (built-in colours are not stored). */
  palette: string[];
}

export const firstFileName = () => nextFileName([]);

/** "File N" for the lowest N not already taken. */
export function nextFileName(names: string[]) {
  let n = 1;
  while (names.includes(`File ${n}`)) n++;
  return `File ${n}`;
}

/** "<name> copy", then "<name> copy 2" and so on, for the first one not already taken. */
export function copyName(name: string, names: string[]) {
  let candidate = `${name} copy`;
  for (let n = 2; names.includes(candidate); n++) candidate = `${name} copy ${n}`;
  return candidate;
}

/** A saved file, or a pre-files save, which has the same fields apart from `id` and `name`. */
interface RawFile {
  id?: unknown;
  name?: unknown;
  doc?: unknown;
  view?: View | null;
}

function readFile(raw: RawFile | null): SavedFile | null {
  const doc = raw && readLayout(raw.doc);
  if (!doc) return null;
  return {
    id: typeof raw.id === 'string' ? raw.id : uid(),
    name: typeof raw.name === 'string' && raw.name ? raw.name : 'File 1',
    doc,
    view: raw.view ?? null,
  };
}

/** The autosaved files, migrated to the current format, or a single file with the sample layout. */
export function loadSaved(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    // Saves from before there were several files hold just one `doc` and `view`.
    const files = (Array.isArray(saved?.files) ? saved.files : [saved]).map(readFile).filter(Boolean);
    if (files.length) {
      return {
        files,
        activeId: files.some((f: SavedFile) => f.id === saved.activeId) ? saved.activeId : files[0].id,
        palette: Array.isArray(saved.palette)
          ? saved.palette.filter((c: string) => !DEFAULT_COLORS.includes(c))
          : [],
      };
    }
  } catch {
    // unreadable save: start fresh
  }
  const file = { id: uid(), name: firstFileName(), doc: sampleDoc(), view: null };
  return { files: [file], activeId: file.id, palette: [] };
}

interface Subscribable<T> {
  subscribe(listener: (state: T, prev: T) => void): () => void;
}

/** Saves the files, active file, view and palette shortly after any of them changes. */
export function autosave<T>(
  store: Subscribable<T>,
  toSaved: (state: T) => Saved,
  changed: (state: T, prev: T) => boolean,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return store.subscribe((state, prev) => {
    if (!changed(state, prev)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSaved(state)));
      } catch {
        // storage full or blocked: keep working unsaved
      }
    }, SAVE_DELAY_MS);
  });
}
