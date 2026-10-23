#!/usr/bin/env node
//
// pot-coverage.mjs — did every translatable string reach a catalogue?
//
//     npm run check:pot             regenerate both POTs, then compare
//     npm run check:pot -- --reuse  compare against the POTs already on disk
//
// Needs the bundles built (`npm run build`) and wp-cli on the PATH. Exit 0 =
// every call site is in its POT. 1 = at least one is not, all printed. 2 = the
// check could not run (no wp-cli, a POT or a bundle missing, the self-check
// failed) — never reported as a pass.
//
// Ported from WSMS 8's bin/pot-coverage.mjs, which exists for the reason this
// one does: `wp i18n make-pot` drops a call it cannot parse and says nothing.
// Here the proof was the whole admin. Its minifier renamed `__` to `c`, so
// make-pot found 2,651 strings in free and not one of them from the admin's
// 3,703 calls — and every other guard was green, because none read the POT.
// A string in no catalogue renders English on every localised install and
// nothing anywhere reports it.
//
// THE RULE, PER SURFACE. Each call site whose msgid (and plural and context,
// where it has them) is a literal must be in its domain's POT — `wconvert`
// for free, `wconvert-pro` for Pro, read off the `build:pot*` scripts:
//
//   - PHP — the POT entry must carry a `#: path:line` reference to THIS call.
//     Not msgid membership: a call whose msgid another, extractable call also
//     contributes would pass a membership test while being itself invisible.
//     make-pot writes the line of the function name, which is what the reader
//     reports.
//   - JS/TS — the sources are not what make-pot reads. It reads the BUILT
//     bundles (.ts/.tsx are never scanned), and every JS reference in the POT
//     points into a `public/`. So there is no source line to match, and the
//     rule is the strongest one that exists: the entry is referenced from at
//     least one built .js file. A PHP call with the same msgid cannot satisfy
//     it. What it cannot tell apart is two JS sources with the same msgid, one
//     bundled and one not — a source map would, and nothing here reads one.
//
//     A source file that no shipped source imports and no bundler config names
//     as an entry is not shipped at all — dead code, not a lost string — and is
//     listed as a note, not failed. "Imported" matches by path tail, which errs
//     towards imported, so towards checking.
//   - block.json — `title`, `description` and each `keywords` entry, under the
//     contexts make-pot gives them, referenced from a block.json.
//
// THE DOMAIN IS PART OF THE RULE, and it is what keeps the two plugins apart.
// Free's POT is made with `--exclude=pro` and Pro's from `pro/` alone, so a
// `'wconvert'` call under `pro/` is in no catalogue — free's language pack is
// built from free's ZIP, which does not contain it — and is reported. So is a
// `'wconvert-pro'` call in free, and a free source file only Pro's bundle
// imports: free's POT never sees it, so no free catalogue holds its strings.
//
// A call whose msgid is NOT a literal is not extractable by anyone and is
// counted, not failed; a literal domain that is neither POT's domain is a
// finding (a typo reaches no catalogue either).
//
// WHY THERE IS A SELF-CHECK. A comparator that matches nothing reports a
// perfect score. So before the tree, every run copies tests/fixtures/pot-coverage,
// minifies its `src/minified.js` with the admin build's own GETTEXT_SAFE_TERSER,
// generates a POT for the copy with the same make-pot and runs the same
// compare() over it. The fixture holds an extractable call for each surface and
// three that are not — the cast-count plural, the same shape under a msgid
// another call does contribute (which only a `#:` comparison catches), and a
// JS source whose string never reached the bundle — plus a JS file nothing
// imports. The run refuses to judge the tree unless it finds exactly those
// three, sets aside exactly that file, finds the minified call with its
// translators comment intact, and hears make-pot's audit flag exactly the one
// placeholder planted without a comment.

import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = 'tests/fixtures/pot-coverage';
const FIXTURE_DOMAIN = 'wconvert-fixture';

/** bin/gettext-functions.json — the table the PHP reader uses too. */
export function gettextFunctions() {
  const { functions } = JSON.parse(readFileSync(resolve(ROOT, 'bin/gettext-functions.json'), 'utf8'));
  return functions;
}

// ---------------------------------------------------------------------------
// POT
// ---------------------------------------------------------------------------

/** One PO string token's value: `"a\"b\n"` → `a"b<LF>`. */
function unquote(token) {
  return JSON.parse(token.replace(/\\([^"\\/bfnrtu])/g, '$1'));
}

const entryKey = (context, msgid) => `${context ?? ''}\u0004${msgid}`;

/**
 * A POT file as `key → {plural, refs, comments}`, key being context + msgid —
 * gettext's own identity for an entry.
 *
 * @param text   the POT's contents
 * @param prefix prepended to every `#:` reference, so a POT made from `pro/`
 *               speaks in the same repository-relative paths as the sources
 * @returns {Map<string, {plural: string|null, refs: string[], comments: string[]}>}
 */
export function parsePot(text, prefix = '') {
  const entries = new Map();
  let refs = [];
  let comments = [];
  let fields = {};
  let current = null;

  const flush = () => {
    if (fields.msgid !== undefined && fields.msgid !== '') {
      const key = entryKey(fields.msgctxt, fields.msgid);
      const known = entries.get(key);
      if (known) {
        known.refs.push(...refs);
        known.comments.push(...comments);
      } else {
        entries.set(key, { plural: fields.msgid_plural ?? null, refs, comments });
      }
    }
    refs = [];
    comments = [];
    fields = {};
    current = null;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') {
      flush();
    } else if (line.startsWith('#:')) {
      if (fields.msgid !== undefined) flush();
      refs.push(...line.slice(2).trim().split(/\s+/).filter(Boolean).map((ref) => prefix + ref));
    } else if (line.startsWith('#.')) {
      if (fields.msgid !== undefined) flush();
      comments.push(line.slice(2).trim());
    } else if (line.startsWith('#')) {
      if (fields.msgid !== undefined) flush();
    } else {
      const m = line.match(/^(msgctxt|msgid_plural|msgid|msgstr(?:\[\d+\])?)\s+(".*")$/);
      if (m) {
        if (m[1] === 'msgctxt' && fields.msgid !== undefined) flush();
        current = m[1];
        fields[current] = unquote(m[2]);
      } else if (line.startsWith('"') && current) {
        fields[current] += unquote(line);
      }
    }
  }
  flush();

  return entries;
}

// ---------------------------------------------------------------------------
// Call sites
// ---------------------------------------------------------------------------

/** PHP call sites, read by PHP's tokenizer through bin/pot-call-sites.php. */
export function phpCallSites(files, cwd) {
  if (files.length === 0) return [];
  const out = execFileSync('php', [resolve(ROOT, 'bin/pot-call-sites.php')], {
    cwd,
    input: files.join('\n'),
    maxBuffer: 256 * 1024 * 1024,
  });
  return JSON.parse(out.toString()).map((s) => ({ ...s, kind: 'php' }));
}

/** The value of a string literal node, or null for anything else. */
function literal(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return literal(node.expression);
  return null;
}

/**
 * JS/TS call sites, read with the TypeScript parser — a regex cannot tell an
 * argument from a comment or a JSX text node.
 *
 * `__(…)`, `i18n.__(…)` and `(0, i18n.__)(…)` all count: the last two are how a
 * bundler rewrites an import.
 */
export function jsCallSites(file, code) {
  const functions = gettextFunctions();
  const kind = /\.tsx$/.test(file) ? ts.ScriptKind.TSX
    : /\.[cm]?ts$/.test(file) ? ts.ScriptKind.TS
      : /\.jsx$/.test(file) ? ts.ScriptKind.JSX : ts.ScriptKind.JS;
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, kind);
  const sites = [];

  // `import { __ as t } from '@wordpress/i18n'` — the local name is what the
  // calls use, the imported one is what the table knows.
  const aliases = new Map();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.moduleSpecifier.text !== '@wordpress/i18n') continue;
    const named = statement.importClause?.namedBindings;
    if (named && ts.isNamedImports(named)) {
      for (const element of named.elements) {
        if (element.propertyName) aliases.set(element.name.text, element.propertyName.text);
      }
    }
  }

  const calleeName = (expr) => {
    if (ts.isIdentifier(expr)) return aliases.get(expr.text) ?? expr.text;
    if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
    if (ts.isParenthesizedExpression(expr)) return calleeName(expr.expression);
    if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.CommaToken) {
      return calleeName(expr.right);
    }
    return null;
  };

  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node.expression);
      const spec = name && Object.hasOwn(functions, name) ? functions[name] : null;
      if (spec) {
        const arg = (part) => (spec[part] ? literal(node.arguments[spec[part] - 1]) : null);
        sites.push({
          kind: 'js',
          file,
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          fn: name,
          msgid: arg('msgid'),
          plural: arg('plural'),
          context: arg('context'),
          domain: arg('domain'),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return sites;
}

/** A block.json's translatable fields, in the contexts make-pot extracts them under. */
export function blockJsonSites(file, code) {
  let block;
  try {
    block = JSON.parse(code);
  } catch {
    return [];
  }
  if (!block || typeof block !== 'object') return [];
  // No textdomain is not "nothing to translate": WordPress translates the
  // block's strings under none, so they reach no catalogue. Its sites carry a
  // domain no POT has, and compare() reports them.
  const domain = typeof block.textdomain === 'string' ? block.textdomain : '(no textdomain)';

  const site = (context, msgid) => ({
    kind: 'block', file, line: 1, fn: 'block.json', msgid, plural: null, context, domain,
  });
  const sites = [];
  const strings = (value) => (Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []);
  if (typeof block.title === 'string') sites.push(site('block title', block.title));
  if (typeof block.description === 'string') sites.push(site('block description', block.description));
  for (const keyword of strings(block.keywords)) sites.push(site('block keyword', keyword));
  // The nested fields make-pot also extracts, each under its own context.
  for (const style of Array.isArray(block.styles) ? block.styles : []) {
    if (typeof style?.label === 'string') sites.push(site('block style label', style.label));
  }
  for (const variation of Array.isArray(block.variations) ? block.variations : []) {
    if (typeof variation?.title === 'string') sites.push(site('block variation title', variation.title));
    if (typeof variation?.description === 'string') sites.push(site('block variation description', variation.description));
    for (const keyword of strings(variation?.keywords)) sites.push(site('block variation keyword', keyword));
  }
  return sites;
}

// ---------------------------------------------------------------------------
// The comparison — one function, run over the fixture and then the tree.
// ---------------------------------------------------------------------------

/**
 * @param sites    every call site found
 * @param catalogs `domain → parsePot()` for each domain a POT exists for
 * @returns {{findings: {site: object, why: string}[], dynamic: number, checked: number}}
 */
export function compare(sites, catalogs) {
  const findings = [];
  let dynamic = 0;
  let checked = 0;

  for (const site of sites) {
    if (site.domain === null) {
      // A domain nothing can read reaches no catalogue — but neither can this
      // say which one it was meant for. i18n-text-domain is the guard for it.
      continue;
    }
    if (site.msgid === null || (site.plural === null && site.kind !== 'block' && needsPart(site, 'plural'))
      || (site.context === null && site.kind !== 'block' && needsPart(site, 'context'))) {
      dynamic++;
      continue;
    }

    const catalog = catalogs.get(site.domain);
    if (!catalog) {
      findings.push({ site, why: `domain '${site.domain}' is not one this repository has a POT for` });
      continue;
    }

    checked++;
    const entry = catalog.get(entryKey(site.context, site.msgid));
    if (!entry) {
      findings.push({ site, why: `no entry in the ${site.domain} POT` });
      continue;
    }
    if (site.plural !== null && entry.plural !== site.plural) {
      findings.push({ site, why: `the POT entry's plural is ${JSON.stringify(entry.plural)}, not this call's` });
      continue;
    }

    const referenced = site.kind === 'php'
      ? entry.refs.includes(`${site.file}:${site.line}`)
      : site.kind === 'js'
        ? entry.refs.some((ref) => /\.js(?::\d+)?$/.test(ref))
        : entry.refs.some((ref) => builtBlockPaths(site.file).includes(ref.replace(/:\d+$/, '')));
    if (!referenced) {
      findings.push({
        site,
        why: site.kind === 'php'
          ? 'the POT has the string, but not from this call — make-pot did not extract it'
          : site.kind === 'js'
            ? 'the POT has the string, but from no built .js file — it never reached a bundle make-pot could read'
            : "the POT has the string, but not from this block's block.json",
      });
    }
  }

  return { findings, dynamic, checked };
}

/**
 * Split JS findings into the ones that count and the files that ship nowhere.
 *
 * A file ships when another source imports it (by path tail) or a bundler
 * config names it as an entry. What a file's strings did is deliberately NOT
 * evidence either way: a common msgid like "Cancel" reaches the POT from some
 * other file, so "one of its strings arrived" says nothing about this one.
 *
 * @param findings    compare()'s findings
 * @param sources     `file → code` for every JS source read
 * @param configText  the bundler configs' source, concatenated
 */
export function splitUnshipped(findings, sources, configText) {
  const specifiers = [];
  for (const [file, code] of sources) {
    for (const { fileName } of ts.preProcessFile(code, true, true).importedFiles) {
      specifiers.push({ from: file, tail: fileName.replace(/\.(?:[cm]?[jt]sx?)$/, '') });
    }
  }
  const ships = (file) => {
    if (configText.includes(file)) return true;
    const bare = file.replace(/\.(?:[cm]?[jt]sx?)$/, '');
    const names = [bare.split('/').pop()];
    if (names[0] === 'index') names.push(bare.split('/').slice(-2, -1)[0]);
    return specifiers.some(({ from, tail }) => from !== file
      && names.some((n) => tail === n || tail.endsWith(`/${n}`)));
  };

  const failedHere = new Map();
  for (const { site } of findings) {
    if (site.kind === 'js') failedHere.set(site.file, (failedHere.get(site.file) ?? 0) + 1);
  }
  const unshipped = [...failedHere.keys()].filter((file) => !ships(file)).sort();
  const dead = new Set(unshipped);

  return {
    findings: findings.filter(({ site }) => !(site.kind === 'js' && dead.has(site.file))),
    unshipped: unshipped.map((file) => ({ file, strings: failedHere.get(file) })),
  };
}

/**
 * Where make-pot finds a block.json: the source path itself, or its BUILT copy
 * under `public/`. The whole path, so two blocks that share a directory name
 * cannot vouch for each other's strings.
 */
function builtBlockPaths(file) {
  return [file, file.replace(/(^|\/)resources\//, '$1public/')];
}

function needsPart(site, part) {
  const spec = gettextFunctions()[site.fn];
  return Boolean(spec && spec[part]);
}

const describe = ({ site, why }) => {
  const ctx = site.context !== null ? ` [${site.context}]` : '';
  return `  ${site.file}:${site.line}  ${site.fn}(${JSON.stringify(site.msgid)}, '${site.domain}')${ctx} — ${why}`;
};

// ---------------------------------------------------------------------------
// The tree
// ---------------------------------------------------------------------------

const JS_SOURCE = /\.(?:[cm]?js|jsx|[cm]?ts|tsx)$/;
const BUNDLER_CONFIG = /^vite\.(?:config|[a-z]+-config)[^/]*\.(?:[cm]?js|ts)$/;
const NOT_SHIPPED = /(^|\/)(?:__tests__|__mocks__|mocks|tests|public)\/|\.(?:test|spec)\.[a-z]+$|\.d\.ts$/;

/** The tracked sources, by surface. Read from git so node_modules and build output never enter. */
function trackedSources(cwd, jsRoots) {
  const files = execFileSync('git', ['ls-files'], { cwd, maxBuffer: 64 * 1024 * 1024 })
    .toString().split('\n').filter(Boolean);
  // Everything make-pot is told to leave out of both POTs, because none of it
  // ships in either ZIP: tooling, tests and stubs.
  const outside = /^(?:tests|bin|docs|tools|phpstan-stubs|\.claude|\.github|\.agents|pro\/tests|pro\/bin)\//;
  return {
    php: files.filter((f) => f.endsWith('.php') && !outside.test(f) && !/(^|\/)phpstan-bootstrap\.php$/.test(f)),
    js: files.filter((f) => JS_SOURCE.test(f) && jsRoots.some((r) => f.startsWith(r)) && !NOT_SHIPPED.test(f)),
    blocks: files.filter((f) => /(^|\/)block\.json$/.test(f) && jsRoots.some((r) => f.startsWith(r)) && !NOT_SHIPPED.test(f)),
    configs: files.filter((f) => BUNDLER_CONFIG.test(f)),
    bundles: builtBundles(cwd),
  };
}

/** Every built .js either plugin ships — gitignored, so read from disk rather than from git. */
function builtBundles(cwd) {
  const out = [];
  const walk = (dir) => {
    if (!existsSync(resolve(cwd, dir))) return;
    for (const entry of readdirSync(resolve(cwd, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.js')) out.push(path);
    }
  };
  ['public', 'pro/public', ...readdirSync(resolve(cwd, 'pro/modules')).map((m) => `pro/modules/${m}/public`)].forEach(walk);
  return out;
}

/** Every call site of every surface, and the JS sources they came from. */
function collect(cwd, { php, js, blocks }) {
  const sources = new Map(js.map((f) => [f, readFileSync(resolve(cwd, f), 'utf8')]));
  const sites = [
    ...phpCallSites(php, cwd),
    ...[...sources].flatMap(([f, code]) => jsCallSites(f, code)),
    ...blocks.flatMap((f) => blockJsonSites(f, readFileSync(resolve(cwd, f), 'utf8'))),
  ];
  return { sites, sources };
}

/** compare(), then set aside the JS files that ship nowhere. */
function judge(cwd, files, catalogs) {
  const { sites, sources } = collect(cwd, files);
  const compared = compare(sites, catalogs);
  const configText = files.configs.map((f) => readFileSync(resolve(cwd, f), 'utf8')).join('\n');
  const shipped = splitUnshipped(compared.findings, sources, configText);
  const bundled = splitUnbundled(shipped.findings, files.bundles.map((f) => readFileSync(resolve(cwd, f), 'utf8')).join('\n'));
  return { ...compared, sites, findings: bundled.findings, unshipped: shipped.unshipped, unbundled: bundled.unbundled };
}

/**
 * Set aside the JS strings that are in no built file at all.
 *
 * A file can ship while one of its strings does not: the minifier drops a
 * branch it can prove is never taken — `howOftenSummary()`'s priority clause,
 * whose one shipped caller passes 0 — and a function only a test calls is
 * tree-shaken out of every bundle. Nothing renders such a string, so nothing
 * needs it translated, and failing on it would demand a catalogue entry for
 * words no visitor or merchant ever sees.
 *
 * The test is the literal itself, in the bundles' text. A string the minifier
 * KEPT but make-pot did not read — a call folded into `__(c ? 'a' : 'b')`, a
 * file Peast rejected, a Pro-only helper in free's domain — is still there,
 * and still fails. Only "in no file that ships" is set aside.
 */
export function splitUnbundled(findings, bundleText) {
  const inBundle = (msgid) => bundleText.includes(msgid) || bundleText.includes(JSON.stringify(msgid).slice(1, -1));
  const unbundled = findings.filter(({ site }) => site.kind === 'js' && !inBundle(site.msgid));
  const dead = new Set(unbundled);
  return { findings: findings.filter((finding) => !dead.has(finding)), unbundled: unbundled.map(({ site }) => site) };
}

/**
 * The POT each domain is built into, read from the package.json scripts that
 * build them — so this check and `npm run build:pot*` cannot name different
 * files, different domains or different source trees.
 */
function potScripts() {
  const { scripts } = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
  const found = [];
  for (const [name, command] of Object.entries(scripts)) {
    const m = command.match(/i18n make-pot (\S+) (\S+\.pot)\b.*--domain=(\S+)/);
    if (m) found.push({ name, source: m[1], pot: m[2], domain: m[3] });
  }
  return found;
}

function fail2(message) {
  console.error(`\n✗ pot-coverage: ${message}\n  The check did not run, so it has not passed.`);
  process.exit(2);
}

function makePot(dir, out, domain) {
  const res = spawnSync('php', ['-d', 'error_reporting=E_ERROR', '-d', 'memory_limit=512M', wpBinary(),
    'i18n', 'make-pot', dir, out, `--domain=${domain}`, '--slug=fixture',
    '--exclude=src', '--allow-root', '--debug'], { encoding: 'utf8' });
  if (res.status !== 0) fail2(`make-pot failed on the fixture:\n${res.stderr}`);
  return { skipped: unparsed(res.stderr), audit: audited(res.stderr) };
}

/**
 * make-pot's own audit, the two warnings a translator pays for: a placeholder
 * with no `translators:` comment to say what it holds, and a plural whose
 * singular drops the number — which a language whose "one" form also covers
 * 21 needs. ESLint catches the first in TypeScript; this is the only check
 * that reads it in PHP, and the only one that reads the second anywhere.
 *
 * The others it prints are left alone. "Different translator comments" on
 * `Actions for %s` is two honest descriptions of one pattern, and an
 * ambiguous short word is what `_x()` is for, which is a review call rather
 * than a rule.
 */
function audited(output) {
  return [...output.matchAll(/Warning: (The string "(.+?)" contains placeholders but has no "translators:" comment|Missing singular placeholder)[^(]*\((.+?):(\d+)\)/g)]
    .map(([, kind, msgid, file, line]) => ({ file, line: Number(line), msgid: msgid ?? null, why: kind.startsWith('Missing') ? 'its singular has no placeholder' : 'no translators: comment for its placeholder' }));
}

/**
 * The files make-pot gave up on.
 *
 * ========================================================================
 * IT SKIPS A FILE IT CANNOT PARSE, AND SAYS SO ONLY UNDER --debug.
 * ========================================================================
 * Peast, the JavaScript parser inside make-pot, rejects some shapes a
 * minifier writes, and make-pot then extracts nothing from the WHOLE file —
 * one builder chunk lost 2,000 strings that way, with `Success:` printed
 * after it. The per-call comparison would report every one of them, but
 * not why; this names the file and the position.
 */
function unparsed(debugOutput) {
  return [...debugOutput.matchAll(/Could not parse file (.+?): (.+?) \(\d+\.\d+s\)/g)]
    .map(([, file, why]) => ({ file, why }));
}

function wpBinary() {
  const res = spawnSync('sh', ['-c', 'command -v wp'], { encoding: 'utf8' });
  const path = res.stdout.trim();
  if (res.status !== 0 || path === '') {
    fail2('wp-cli is not installed. It generates the POTs this check reads; CI installs it (ci.yml `pot-coverage`).');
  }
  return path;
}

/**
 * The fixture's `src/minified.js`, minified exactly as the admin build minifies
 * its bundle — the settings are imported from the admin config, not restated.
 */
async function minifyLikeTheAdmin(from, to) {
  const { GETTEXT_SAFE_TERSER } = await import(pathToFileURL(resolve(ROOT, 'vite.admin-config.mjs')).href);
  const { minify } = await import('terser');
  const { code } = await minify(readFileSync(from, 'utf8'), { ...GETTEXT_SAFE_TERSER, module: true });
  writeFileSync(to, code);
}

/**
 * Run compare() over the fixture and demand exactly the three planted misses.
 * Anything else — a miss not found, an extra one — and the verdict on the tree
 * would mean nothing.
 */
async function selfCheck() {
  const work = mkdtempSync(join(tmpdir(), 'wconvert-pot-coverage-'));
  try {
    const dir = join(work, 'fixture');
    cpSync(resolve(ROOT, FIXTURE), dir, { recursive: true });
    mkdirSync(join(dir, 'build'), { recursive: true });
    await minifyLikeTheAdmin(join(dir, 'src/minified.js'), join(dir, 'build/minified.js'));

    const pot = join(work, 'fixture.pot');
    const { skipped, audit } = makePot(dir, pot, FIXTURE_DOMAIN);
    const catalog = parsePot(readFileSync(pot, 'utf8'));

    const { sites, findings, unshipped, unbundled } = judge(dir, {
      php: ['plugin.php'],
      js: ['src/app.tsx', 'src/dead.tsx', 'src/index.ts', 'src/minified.js'],
      blocks: ['blocks/fixture/block.json'],
      configs: ['vite.config.mjs'],
      bundles: readdirSync(join(dir, 'build')).map((f) => `build/${f}`),
    }, new Map([[FIXTURE_DOMAIN, catalog]]));
    const shaken = unbundled.map((site) => site.msgid);
    const got = findings.map(({ site }) => site.msgid).sort();
    const want = ['Fixture cast', 'Fixture dropped', 'Fixture shared'];
    const seen = new Set(sites.map((s) => s.msgid));
    const planted = ['Fixture simple', 'Fixture multi', 'Fixture ctx', 'Fixture bundled', 'Fixture block', 'Fixture dead',
      'Fixture shaken', 'Fixture minified %s', 'Fixture on', 'Fixture off', 'Fixture listed'];
    const deadFiles = unshipped.map((u) => u.file);
    const minified = catalog.get(entryKey(null, 'Fixture minified %s'));
    const commented = Boolean(minified?.comments.some((c) => c.startsWith('translators:')));

    if (JSON.stringify(got) !== JSON.stringify(want) || planted.some((m) => !seen.has(m))
      || JSON.stringify(deadFiles) !== JSON.stringify(['src/dead.tsx']) || !commented
      || JSON.stringify(skipped.map(({ file }) => file)) !== JSON.stringify(['build/broken.js']) || JSON.stringify(shaken) !== JSON.stringify(['Fixture shaken'])
      || JSON.stringify(audit.map(({ msgid }) => msgid)) !== JSON.stringify(['Fixture uncommented %s'])) {
      fail2(
        `SELF-CHECK FAILED on ${FIXTURE}.\n`
          + `  expected exactly ${JSON.stringify(want)} unextracted, got ${JSON.stringify(got)};\n`
          + `  expected exactly ["src/dead.tsx"] set aside as unshipped, got ${JSON.stringify(deadFiles)};\n`
          + `  expected every one of ${JSON.stringify(planted)} to be read as a call site;\n`
          + `  expected "Fixture minified %s" to keep its translators comment through the admin's minifier: ${commented ? 'kept' : 'LOST'};\n`
          + `  expected exactly ["Fixture shaken"] set aside as in no bundle, got ${JSON.stringify(shaken)};\n`
          + `  expected make-pot to skip exactly ["build/broken.js"], and it skipped ${JSON.stringify(skipped.map(({ file }) => file))};\n`
          + `  expected the audit to flag exactly ["Fixture uncommented %s"], and it flagged ${JSON.stringify(audit.map(({ msgid }) => msgid))}.\n`
          + '  If a "Fixture minified/on/off/listed" string is among the unextracted, or build/minified.js was\n'
          + '  skipped, GETTEXT_SAFE_TERSER no longer produces what make-pot can read — and neither does the\n'
          + '  admin build. Otherwise the comparator cannot see what it is looking for, so its verdict on the\n'
          + '  tree means nothing.'
      );
    }
    console.log(
      `✓ self-check: the fixture's ${want.length} unextractable calls and its unparseable bundle were found, its unimported `
        + 'file and its tree-shaken string were set aside, its admin-minified calls kept their names and their translators '
        + 'comment, the audit flagged its uncommented placeholder, and its good calls passed'
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** The bundles the POTs read their JS strings from: an unbuilt tree is not a passing one. */
function requireBuilt() {
  for (const dir of ['public/admin', 'pro/public/admin']) {
    const entry = existsSync(resolve(ROOT, dir))
      && readdirSync(resolve(ROOT, dir)).some((f) => /^main-.+\.js$/.test(f));
    if (!entry) {
      fail2(`${dir}/main-*.js is not built. The POTs read JS strings from the bundles; run \`npm run build\` first.`);
    }
  }
}

async function main() {
  const reuse = process.argv.includes('--reuse');
  const scripts = potScripts();
  if (scripts.length === 0) fail2('package.json has no `wp i18n make-pot` script to read the POT paths from.');

  await selfCheck();
  requireBuilt();

  const catalogs = new Map();
  const skipped = [];
  const audit = [];
  for (const { name, source, pot, domain } of scripts) {
    if (!reuse) {
      const res = spawnSync('npm', ['run', name, '--silent', '--', '--debug'], {
        cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: { ...process.env, WP_CLI_ALLOW_ROOT: '1' },
      });
      if (res.status !== 0) fail2(`\`npm run ${name}\` failed:\n${res.stderr}`);
      skipped.push(...unparsed(res.stderr).map(({ file, why }) => ({ file: source === '.' ? file : `${source}/${file}`, why })));
      audit.push(...audited(res.stderr).map((warning) => ({ ...warning, file: source === '.' ? warning.file : `${source}/${warning.file}` })));
    }
    if (!existsSync(resolve(ROOT, pot))) fail2(`${pot} does not exist (run without --reuse to generate it).`);
    catalogs.set(domain, parsePot(readFileSync(resolve(ROOT, pot), 'utf8'), source === '.' ? '' : `${source}/`));
  }

  const { findings, dynamic, checked, unshipped, unbundled } = judge(ROOT, trackedSources(ROOT, ['resources/', 'pro/']), catalogs);

  if (skipped.length > 0) {
    console.error(
      `\n✗ pot-coverage: make-pot could not parse ${skipped.length} file(s), and extracted nothing from them:\n\n`
        + skipped.map(({ file, why }) => `  ${file}: ${why}`).join('\n')
        + '\n\nA bundle is the minifier\'s output, so the fix is usually a compress option in\n'
        + 'GETTEXT_SAFE_TERSER (vite.admin-config.mjs) rather than the source.'
    );
  }

  if (unshipped.length > 0) {
    console.warn(
      `\n⚠ pot-coverage: ${unshipped.length} JS source file(s) ship in no bundle — nothing imports them and\n`
        + 'no bundler config names them. Not a lost string, but dead code worth deleting:\n\n'
        + unshipped.map(({ file, strings }) => `  ${file} (${strings} string${strings === 1 ? '' : 's'})`).join('\n')
    );
  }

  if (unbundled.length > 0) {
    console.warn(
      `\n⚠ pot-coverage: ${unbundled.length} JS string(s) are in no built file — the minifier proved them\n`
        + 'unreachable or only a test calls them. Not a lost string, but dead code worth deleting:\n\n'
        + unbundled.map((site) => `  ${site.file}:${site.line}  ${JSON.stringify(site.msgid)}`).sort().join('\n')
    );
  }

  if (findings.length > 0) {
    console.error(
      `\n✗ pot-coverage: ${findings.length} translatable call(s) reached no catalogue:\n\n`
        + findings.map(describe).sort().join('\n')
        + '\n\nEach one renders in English on every localised install. For PHP, rewrite the\n'
        + 'call so make-pot can parse it (hoist a cast count into a variable, say). For JS,\n'
        + "check the string's component is bundled at all. For a domain, code under pro/ says\n"
        + "'wconvert-pro' and everything else says 'wconvert'."
    );
  }

  if (audit.length > 0) {
    console.error(
      `\n✗ pot-coverage: make-pot's audit flagged ${audit.length} string(s) a translator would have to guess at:\n\n`
        + audit.map(({ file, line, msgid, why }) => `  ${file}:${line}  ${msgid === null ? '' : `${JSON.stringify(msgid)} — `}${why}`).sort().join('\n')
        + '\n\nA built .js line is the bundle\'s; find the string in the TypeScript. Put the comment\n'
        + 'right before the gettext call — /* translators: %s: what it holds. */ __(…) — and give\n'
        + 'a plural\'s singular its number: _n(\'%d item\', \'%d items\', n).'
    );
  }

  if (findings.length > 0 || skipped.length > 0 || audit.length > 0) {
    process.exit(1);
  }

  console.log(
    `✓ pot-coverage: ${checked} call sites across ${catalogs.size} POTs, every one extracted`
      + (dynamic > 0 ? ` (${dynamic} with a non-literal msgid, which no tool can extract, not counted)` : '')
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
