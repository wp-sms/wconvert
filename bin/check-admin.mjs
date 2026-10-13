#!/usr/bin/env node
//
// check-admin.mjs — the free contract, proven at the admin and inspector builds.
//
// A program of its own beside bin/check-loader.mjs (ADR 0029: one program per
// condition, no flags), added by ADR 0147.
//
//     npm run check:admin
//     node bin/check-admin.mjs [tree]     (default: the repo root)
//
// Two assertions over free's built `public/admin/**` and `public/inspector/**`:
//
//   1. NO PRO MODULE'S ADMIN CODE. A module whose editors live in Pro's admin
//      bundle declares `admin_markers` in its `module.json`: strings its admin
//      code carries and free's never does. Journey authoring is the first
//      (ADR 0147): it used to ship in free's bundle behind a filter only Pro
//      adds, which is trialware under wp.org guideline 5.
//
//      NOT THE PREMIUM-IDENTIFIER SCAN. check-loader reads the rule manifest's
//      paid types and looks for them; here that would fail on purpose-built
//      copy. Free's admin names Pro's features in the hints ADR 0147 adds, so
//      `exit_intent` belongs in it. What may not be in it is Pro's CODE, and a
//      marker is how a module says what its code looks like.
//
//   2. NO "UPGRADE". ADR 0116 and 0147 let free name what Pro adds; neither
//      lets it tell the merchant to upgrade. Matched as a word starting
//      `upgrade`/`Upgrade`, so React's `..._CANNOT_UPGRADE` and a prop such as
//      `onUpgrade` are code, not copy, and do not trip it.
//
//      NO PRODUCT-NAME SCAN. `tierProductName()` builds "WConvert Pro" at
//      runtime and the hints rightly print it.
//
// IT FAILS CLOSED. A bundle it cannot read, or a directory with no JavaScript
// in it, is a failure: "couldn't look" must never read as "clean".
//
// The optional positional tree is not a flag; it exists so
// tests/unit/Contract/AdminContractTest.php can point this at trees it builds.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = process.argv[2] ? resolve(process.argv[2]) : REPO_ROOT;

/** Free's admin-side bundles: every file is scanned, chunks included. */
const BUNDLES = [
  { label: 'free admin', dir: 'public/admin' },
  { label: 'free inspector', dir: 'public/inspector' },
];

const MODULES = 'pro/modules';

const UPGRADE = /\b[Uu]pgrade/g;

console.log(`==> check-admin: ${ROOT}`);

const problems = [];
const fail = (message) => problems.push(message);

/** Every `.js` file under a directory, recursively. */
function scripts(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return scripts(path);
    return entry.name.endsWith('.js') ? [path] : [];
  });
}

/**
 * A bundle's JavaScript as one string per file, or null after failing closed.
 *
 * @returns {{file: string, text: string}[] | null}
 */
function readBundle({ label, dir }) {
  const absolute = resolve(ROOT, dir);
  let files;

  try {
    if (!statSync(absolute).isDirectory()) throw Object.assign(new Error('not a directory'), { code: 'ENOTDIR' });
    files = scripts(absolute);
  } catch (error) {
    fail(`${label}: cannot read ${dir}/ (${error.code ?? error.message}) — run the build; nothing was inspected`);
    return null;
  }

  if (files.length === 0) {
    fail(`${label}: ${dir}/ holds no JavaScript — nothing was inspected, so nothing is proven`);
    return null;
  }

  const read = files.map((file) => ({ file: relative(ROOT, file), text: readFileSync(file, 'utf8') }));

  for (const { file, text } of read) {
    if (text.length === 0) fail(`${label}: ${file} is empty — nothing was inspected, so nothing is proven`);
  }

  return read;
}

/**
 * Every module's `admin_markers`, and the modules that declare none.
 *
 * @returns {{markers: {slug: string, marker: string}[], unscanned: string[]}}
 */
function adminMarkers() {
  const markers = [];
  const unscanned = [];

  for (const entry of readdirSync(resolve(ROOT, MODULES), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const declared = JSON.parse(readFileSync(resolve(ROOT, MODULES, entry.name, 'module.json'), 'utf8'));
    const list = declared?.admin_markers;

    if (Array.isArray(list) && list.length > 0 && list.every((marker) => typeof marker === 'string' && marker !== '')) {
      markers.push(...list.map((marker) => ({ slug: declared.slug, marker })));
    } else if (list !== undefined) {
      throw new Error(`${entry.name}/module.json: admin_markers must be a non-empty list of non-empty strings`);
    } else {
      unscanned.push(declared.slug);
    }
  }

  return { markers, unscanned };
}

let modules = null;

try {
  modules = adminMarkers();
} catch (error) {
  fail(`cannot read the module manifests (${error.message}) — the marker scan inspected nothing`);
}

for (const bundle of BUNDLES) {
  const files = readBundle(bundle);

  if (files === null) continue;

  // --- 1. No Pro module's admin code ----------------------------------------
  if (modules !== null) {
    if (modules.markers.length === 0) {
      console.log(`  ! ${bundle.label}: no module declares admin markers, so this scan asserted nothing`);
    } else {
      const found = modules.markers.flatMap(({ slug, marker }) => files.filter(({ text }) => text.includes(marker)).map(({ file }) => ({ slug, marker, file })));

      console.log(`  ${found.length === 0 ? '✓' : '✗'} ${bundle.label}: scanned ${files.length} file(s) for ${modules.markers.length} admin marker(s)`);

      for (const { slug, marker, file } of found) fail(`${bundle.label}: ${file} contains "${marker}", ${slug}'s admin code`);
    }
  }

  // --- 2. No "upgrade" ------------------------------------------------------
  const upgrades = files.flatMap(({ file, text }) => [...text.matchAll(UPGRADE)]
    .map((match) => ({ file, context: text.slice(Math.max(0, match.index - 40), match.index + 40) })));

  console.log(`  ${upgrades.length === 0 ? '✓' : '✗'} ${bundle.label}: no "upgrade" in its copy`);

  for (const { file, context } of upgrades) fail(`${bundle.label}: ${file} says "upgrade" (…${context}…)`);
}

// Said out loud beside the tick, never folded into it.
if (modules !== null && modules.unscanned.length > 0) {
  console.log(`  ! ${modules.unscanned.join(', ')} declare no admin markers and were not scanned for`);
}

if (problems.length > 0) {
  console.error('\n==> check-admin FAILED:');
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}

console.log('  ✓ admin contract clean');
