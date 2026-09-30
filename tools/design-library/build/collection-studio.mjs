import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'vite';
const root = resolve(import.meta.dirname, '../../..'), out = resolve(root, 'tools/design-library/out');
await build({ configFile: false, logLevel: 'error', build: { emptyOutDir: false, outDir: out, lib: { entry: resolve(root, 'resources/admin/src/discovery/model.ts'), name: 'WConvertDiscovery', formats: ['iife'], fileName: () => 'discovery-model.js' } } });
const read = path => JSON.parse(readFileSync(resolve(out, path), 'utf8'));
const review = read('collections-review.json'), entries = read('pilot.json');
const source = readFileSync(resolve(root, 'tools/design-library/collections/studio.html'), 'utf8');
writeFileSync(resolve(out, 'collection-studio.html'), source.replace('/*__MODEL__*/', readFileSync(resolve(out, 'discovery-model.js'), 'utf8'))
  .replace('/*__RENDERER__*/', () => readFileSync(resolve(out, 'renderer.iife.js'), 'utf8'))
  .replace('/*__DATA__*/', JSON.stringify({ review, entries }).replaceAll('<', '\\u003c')));
console.log('collection-studio.html — actual prepared setups; simulated site context; no customer data.');
