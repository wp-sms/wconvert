import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Each module's `admin_markers` still name its admin code (ADR 0147).
 *
 * `bin/check-admin.mjs` passes when free's bundle carries none of them, which
 * is also what it says about a marker nothing carries any more. A copy edit
 * in Pro would turn that scan into one that asserts nothing, so every marker
 * has to occur in its module's own admin source.
 */
const MODULES = resolve(import.meta.dirname, '../../modules');

const sources = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? sources(path) : /\.(ts|tsx)$/.test(name) ? [readFileSync(path, 'utf8')] : [];
});

const declared = readdirSync(MODULES).flatMap((slug) => {
  const manifest = JSON.parse(readFileSync(join(MODULES, slug, 'module.json'), 'utf8')) as { admin_markers?: string[] };
  return manifest.admin_markers ? [{ slug, markers: manifest.admin_markers }] : [];
});

describe('admin markers', () => {
  it('are declared by at least one module', () => {
    expect(declared.length).toBeGreaterThan(0);
  });

  for (const { slug, markers } of declared) {
    it(`each of ${slug}'s occurs in its admin source`, () => {
      const text = sources(join(MODULES, slug, 'admin')).join('\n');
      for (const marker of markers) expect(text, marker).toContain(marker);
    });
  }
});
