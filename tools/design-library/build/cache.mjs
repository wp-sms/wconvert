import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Per-design results keyed by exactly what produced them (ADR 0156, Phase 5):
 * the design's bytes, the renderer bundle and the code of the step itself. A
 * publish then renders only the designs that changed. The cache lives in the
 * gitignored `out/` folder and is never a source of truth: a missing or
 * unreadable entry is simply recomputed.
 */
const FOLDER = resolve(import.meta.dirname, '../out/cache');

export function cacheKey(...parts) {
  const hash = createHash('sha256');
  for (const part of parts) hash.update(typeof part === 'string' ? part : JSON.stringify(part)).update('\0');
  return hash.digest('hex');
}

export function cached(step, key) {
  const file = resolve(FOLDER, step, key + '.json');
  if (!existsSync(file)) return undefined;
  try { return JSON.parse(readFileSync(file, 'utf8'), (_, value) => value?.type === 'Buffer' && Array.isArray(value.data) ? Buffer.from(value.data) : value?.$buffer ? Buffer.from(value.$buffer, 'base64') : value); }
  catch { return undefined; }
}

export function remember(step, key, value) {
  mkdirSync(resolve(FOLDER, step), { recursive: true });
  const file = resolve(FOLDER, step, key + '.json'), temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, (_, item) => item?.type === 'Buffer' && Array.isArray(item.data) ? { $buffer: Buffer.from(item.data).toString('base64') } : item));
  renameSync(temporary, file);
  return value;
}

/** This module's own source, so a change to a step's code is a change to its key. */
export const codeOf = url => readFileSync(new URL(url), 'utf8');
