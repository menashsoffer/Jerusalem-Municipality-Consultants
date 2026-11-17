import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { it } from 'node:test';

// Cascade layers rank in the order they are first named. If a component stylesheet loads before
// layers.css, its layer is named first and loses to `base`, so links inside buttons turn purple.
it('imports the layer order before any module that brings its own styles', () => {
  const main = readFileSync(new URL('../../main.tsx', import.meta.url), 'utf8');
  const imports = [...main.matchAll(/^import .*$/gm)].map((match) => match[0]);
  assert.equal(imports[0], "import './styles/layers.css';");
});
