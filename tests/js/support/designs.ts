import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Template } from '@renderer/types';

/**
 * An authored Free design by id, wherever it is authored: bundled in the ZIP,
 * or served by the catalogue alone from `hosted/` (ADR 0157, ADR 0173).
 */
export function freeDesign(id: string): Template {
  const file = ['resources/templates/library', 'tools/design-library/hosted/templates']
    .map(dir => resolve(import.meta.dirname, '../../..', dir, `${id}.json`)).find(existsSync);
  if (file === undefined) throw new Error(`No Free design is authored as ${id}`);
  return JSON.parse(readFileSync(file, 'utf8')) as Template;
}
