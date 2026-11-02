import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The written rules, held against the source (ADR 0182).
 *
 * The ADR 0131 audit fixed these drifts once and nothing stopped them coming
 * back, because GUIDELINES.md is prose. ESLint holds the rules that are about
 * one JSX element, and this holds the ones about a word or a string. Each rule
 * lists what it allows with the reason beside it, so an exception is a decision
 * somebody wrote down rather than a line nobody looked at.
 *
 * Reads source, so it proves a call site uses the shared thing and nothing about
 * how that thing renders (§21): the browser pass still owns that.
 */
const REPO = resolve(__dirname, '../..');
const ALLOW_PATH = resolve(__dirname, 'admin-guidelines-allow.json');
const allowFile = JSON.parse(readFileSync(ALLOW_PATH, 'utf8')) as { eslint: string[] } & Record<string, Record<string, number>>;

/** Every admin surface this project wrote, free and Pro. The renderer and loader are not one. */
function adminRoots(): string[] {
  const modules = resolve(REPO, 'pro/modules');
  return [
    'resources/admin/src',
    'resources/blocks',
    'pro/resources/admin/src',
    ...readdirSync(modules).flatMap((name) => [`pro/modules/${name}/admin`, `pro/modules/${name}/block`]),
  ].filter((root) => existsSync(resolve(REPO, root)));
}

function walk(directory: string, extension: RegExp): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' || entry.name === '__tests__' ? [] : walk(path, extension);
    return extension.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
  });
}

const sources = adminRoots().flatMap((root) => walk(resolve(REPO, root), /\.tsx?$/)).map((path) => ({
  path: relative(REPO, path),
  // Comments explain the rules, and quote what they forbid.
  code: readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''),
}));

/** The strings handed to a gettext call: its text, and a plural's second form. */
export function gettextStrings(source: string): string[] {
  const text = String.raw`'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"`;
  const call = new RegExp(String.raw`\b(?:__|_x)\(\s*(?:${text})|\b_n\(\s*(?:${text})\s*,\s*(?:${text})`, 'g');
  return [...source.matchAll(call)].flatMap((match) => match.slice(1).filter((part) => part !== undefined));
}

const inStrings = (test: RegExp) => (code: string) => gettextStrings(code).filter((text) => test.test(text)).length;
const matches = (test: RegExp) => (code: string) => [...code.matchAll(test)].length;

const RULES: Record<string, { why: string; count: (code: string) => number; owners?: RegExp }> = {
  dates: {
    why: '§8: dates and numbers go through lib/format.ts',
    count: matches(/\bIntl\.|\.toLocale(?:Date|Time)?String\(/g),
    // Timezone arithmetic, which formats nothing a merchant reads.
    owners: /(?:lib\/format\.ts|lib\/wallTime\.ts|leads\/calendar\.ts|discovery\/model\.ts)$/,
  },
  errors: {
    why: '§13: messageOf() is the one place a thrown thing becomes a sentence',
    count: matches(/instanceof Error\s*\?[^:;]*\.message/g),
    owners: /shell\/loadable\.ts$/,
  },
  digits: {
    why: '§8: %d prints ASCII digits on a translated site; use %s and formatCount()',
    count: inStrings(/%(?:\d\$)?d/),
  },
  type: {
    why: '§4: a Tailwind size outside the shared roles',
    count: matches(/\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/g),
    owners: /components\/ui\//,
  },
  retry: {
    why: '§13: "Try again" is the one retry word',
    count: inStrings(/\bretry(?:ing)?\b/i),
  },
  tiers: {
    why: '§14: tierName() and tierProductName(), so renaming the product is a manifest edit',
    count: inStrings(/\bPro\b/),
  },
  pressed: {
    why: '§7: aria-pressed is an independent toggle and never one-of-N; each use here was read and is one',
    count: matches(/aria-pressed/g),
  },
};

function found(rule: { count: (code: string) => number; owners?: RegExp }): Record<string, number> {
  return Object.fromEntries(
    sources
      .filter(({ path }) => !rule.owners?.test(path))
      .map(({ path, code }) => [path, rule.count(code)] as const)
      .filter(([, count]) => count > 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

/** What the ESLint rules forbid, so a file that no longer breaks one leaves their ignore list. */
const ESLINT_SHAPES = /<(?:select|textarea|details)\b|type="checkbox"|<Button\b[^>]*\bsize="sm"|\bside="(?:left|right)"/;

/**
 * The CSS half: a literal colour outside a token's definition (§5), and a shadow
 * that is not a focus ring (§6). Every sheet this project wrote is read.
 */
const sheets = adminRoots().flatMap((root) => walk(resolve(REPO, root), /\.css$/));
function cssFound(test: (selector: string, declaration: string) => boolean): Record<string, number> {
  const result: [string, number][] = [];
  for (const path of sheets) {
    const css = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    let count = 0;
    // Innermost rule at a time, so an at-rule's wrapper is not read as a selector.
    for (const [, selector, body] of css.matchAll(/([^{};]+)\{([^{}]*)\}/g)) {
      for (const declaration of body.split(';')) if (test(selector, declaration.trim())) count += 1;
    }
    if (count > 0) result.push([relative(REPO, path), count]);
  }
  return Object.fromEntries(result.sort(([a], [b]) => a.localeCompare(b)));
}
const LITERAL_COLOUR = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|:\s*(?:white|black)\b/i;
const CSS_RULES: Record<string, { why: string; test: (selector: string, declaration: string) => boolean }> = {
  colours: {
    why: '§5: colours are tokens',
    test: (_selector, declaration) => !declaration.startsWith('--') && LITERAL_COLOUR.test(declaration),
  },
  shadows: {
    why: '§6: shadow tokens are none; a shadow here is a focus ring or the §15 selected rail',
    test: (selector, declaration) => /^box-shadow\s*:/.test(declaration) && !/:\s*(?:none|inherit)\b/.test(declaration) && !/focus|:dir\(/.test(selector),
  },
};

/*
 * Run with WCONVERT_GUIDELINES_SHRINK=1 after a fix to drop what it fixed. It
 * only ever shrinks: a count above what is allowed still fails.
 */
const SHRINK = process.env.WCONVERT_GUIDELINES_SHRINK === '1';
const next = JSON.parse(JSON.stringify(allowFile)) as typeof allowFile;

function holdsTo(name: string, actual: Record<string, number>) {
  const allowed = allowFile[name] ?? {};
  const over = Object.entries(actual).filter(([path, count]) => count > (allowed[path] ?? 0));
  expect(over.map(([path, count]) => `${path}: ${count}, allowed ${allowed[path] ?? 0}`)).toEqual([]);
  if (SHRINK) {
    next[name] = Object.fromEntries(Object.keys(allowed).filter((path) => actual[path]).map((path) => [path, actual[path]]));
    writeFileSync(ALLOW_PATH, `${JSON.stringify(next, null, 2)}\n`);
  } else {
    // A fixed file leaves the list, so the list never allows what has been fixed.
    expect(actual).toEqual(Object.fromEntries(Object.entries(allowed).sort(([a], [b]) => a.localeCompare(b))));
  }
}

describe('the admin guidelines', () => {
  it('reads every admin surface, free and Pro', () => {
    expect(sources.length).toBeGreaterThan(300);
    expect(sources.some(({ path }) => path.startsWith('pro/modules/journeys/admin/'))).toBe(true);
    expect(sources.some(({ path }) => path.startsWith('pro/resources/admin/src/license/'))).toBe(true);
    expect(gettextStrings(`__('Only %d', 'wconvert'); _n("%d line", '%d lines', n, 'wconvert')`)).toEqual(['Only %d', '%d line', '%d lines']);
  });

  for (const [name, rule] of Object.entries(RULES)) {
    it(`${name} — ${rule.why}`, () => holdsTo(name, found(rule)));
  }

  for (const [name, rule] of Object.entries(CSS_RULES)) {
    it(`${name} — ${rule.why}`, () => holdsTo(name, cssFound(rule.test)));
  }

  it('lists no file in the ESLint ignore that no longer breaks a rule', () => {
    const stale = allowFile.eslint.filter((path) => !ESLINT_SHAPES.test(readFileSync(resolve(REPO, path), 'utf8')));
    if (SHRINK) {
      next.eslint = allowFile.eslint.filter((path) => !stale.includes(path));
      writeFileSync(ALLOW_PATH, `${JSON.stringify(next, null, 2)}\n`);
    } else {
      expect(stale).toEqual([]);
    }
  });
});

