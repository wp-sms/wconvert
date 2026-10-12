import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * One idea, one word (ADR 0142). The Flow review found the same setting under
 * five names — "Shown if", "Show only if…", "Only if" — and retired words still
 * on screen. This reads every translatable string in the builder, so a new
 * file cannot bring one back unseen.
 */
const root = resolve(__dirname, '../../resources/admin/src/builder');
const retired: readonly [RegExp, string][] = [
  [/Collect details/, 'Form'],
  [/Journey complete/, 'Ends the campaign'],
  [/Shown if/, 'Only if…'],
  [/Show only if/, 'Only if…'],
  [/Check next/, 'Then → X'],
  [/Choose one path/, 'First match wins'],
  [/\bfallback\b/i, 'All other answers'],
  [/Everyone else/, 'All other answers'],
  [/\bNext screen\b/, 'Then'],
  [/\bjourney\b/i, 'campaign, screens or line'],
  // A URL's path ("/pricing/") is another thing; a way between screens is a line.
  [/\bpaths?\b(?! such as)/i, 'line'],
];

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function strings(source: string): string[] {
  const found: string[] = [];
  const call = /\b(?:__|_n|_x)\(\s*'((?:[^'\\]|\\.)*)'(?:\s*,\s*'((?:[^'\\]|\\.)*)')?/g;
  for (const match of source.matchAll(call)) found.push(match[1], ...(match[2] ? [match[2]] : []));
  return found;
}

describe('the Flow word list', () => {
  it('reads strings from the builder', () => {
    expect(files(root).length).toBeGreaterThan(50);
    expect(strings("__('Only if %s', 'wconvert'); _n('%d line', '%d lines', n, 'wconvert')")).toEqual(['Only if %s', 'wconvert', '%d line', '%d lines']);
  });

  it('keeps retired words out of merchant-facing strings', () => {
    const found = files(root).flatMap(path => strings(readFileSync(path, 'utf8'))
      .flatMap(text => retired.filter(([word]) => word.test(text)).map(([, use]) => `${relative(root, path)}: “${text}” — say ${use}`)));
    expect(found).toEqual([]);
  });
});
