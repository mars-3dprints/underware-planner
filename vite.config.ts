import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** GitHub Pages serves the app from https://mars-3dprints.github.io/underware-planner/. */
const PAGES_BASE = '/underware-planner/';

export default defineConfig(({ command, isPreview }) => ({
  // The dev server stays at the root; builds and `vite preview` use the Pages path.
  base: command === 'build' || isPreview ? PAGES_BASE : '/',
  plugins: [react()],
  test: { environment: 'node' },
}));
