import { DEFAULT_COLORS } from '../domain/constants';
import { readLayout } from '../domain/migrate';
import { sampleDoc } from '../domain/sample';
import type { Doc, View } from '../domain/types';

export const STORAGE_KEY = 'underware-planner-v1';
const SAVE_DELAY_MS = 300;

interface Saved {
  doc: Doc;
  view: View | null;
  /** Custom swatches (built-in colours are not stored). */
  palette: string[];
}

/** The autosaved layout, migrated to the current format, or the sample layout. */
export function loadSaved(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const doc = readLayout(saved?.doc);
    if (doc) {
      return {
        doc,
        view: saved.view ?? null,
        palette: Array.isArray(saved.palette)
          ? saved.palette.filter((c: string) => !DEFAULT_COLORS.includes(c))
          : [],
      };
    }
  } catch {
    // unreadable save: start fresh
  }
  return { doc: sampleDoc(), view: null, palette: [] };
}

interface Subscribable<T> {
  subscribe(listener: (state: T, prev: T) => void): () => void;
}

/** Saves the layout, view and palette shortly after any of them changes. */
export function autosave<T extends Saved>(store: Subscribable<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return store.subscribe((state, prev) => {
    if (state.doc === prev.doc && state.view === prev.view && state.palette === prev.palette) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        const saved: Saved = { doc: state.doc, view: state.view, palette: state.palette };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      } catch {
        // storage full or blocked: keep working unsaved
      }
    }, SAVE_DELAY_MS);
  });
}
