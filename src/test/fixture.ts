import layout from './fixtures/layout.json';
import type { Doc } from '../types';

/** A layout with every kind of part, every channel shape and cables through channels. */
export const fixture = (): Doc => structuredClone(layout.doc) as Doc;
