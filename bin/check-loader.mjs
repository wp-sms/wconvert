#!/usr/bin/env node
//
// check-loader.mjs — the free contract, proven at the loader build.
//
// The second of ADR 0029's three programs. `bin/verify-source-contract.sh`
// needs no build and carries the guarantee; this one is the ONE exception to
// "no build on a pull request", and it earns it: both of its assertions are
// about build OUTPUT, which is the premise that exception lacks.
//
//     npm run check:loader
//     node bin/check-loader.mjs [tree]     (default: the repo root)
//
// Two assertions, and neither is optional:
//
//   1. THE BYTE BUDGET, HARD. Free's and Pro's shipped loader, gzip -9, fail
//      at 8192 bytes, per build. The prototype measured 3.6KB honest and 3.9KB
//      with the whole v1 rule vocabulary, so a threshold at 2x headroom can
//      only fire on a real regression — which is why it blocks rather than
//      warns, and why there is no second warn band nobody would read.
//
//   2. THE PREMIUM-IDENTIFIER SCAN, SCOPED TO THE LOADER BUNDLE ONLY. Its
//      identifier list is read from the rule manifest, so it cannot drift from
//      what the manifest calls premium.
//
//      DO NOT SCAN THE ADMIN BUNDLE. Free's admin bundle contains premium
//      identifiers ON PURPOSE — the data-only catalogue of premium Destination
//      types, and every `locked` Availability card. Free's loader never
//      renders an upsell, so it has no such excuse. Same rule, two bundles,
//      opposite verdicts; WSMS's own script warns against exactly the unscoped
//      version.
//
// IT FAILS CLOSED. A check that cannot inspect what it was asked to inspect
// FAILS, because "couldn't look" reading as "clean" is how a leak ships the
// one time a build is incomplete.
//
// NO FLAGS, EVER (ADR 0029). It is a third program rather than a flag on an
// existing one for the same reason: the moment a compliance check has an
// opt-out, the opt-out is what runs on the day it matters. The optional
// positional tree is not a flag and cannot turn anything off — it is the same
// affordance bin/verify-source-contract.sh has, and it exists so
// tests/unit/Contract/LoaderContractTest.php can point this script at trees it
// builds and prove that it fails closed on each of them.

import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = process.argv[2] ? resolve(process.argv[2]) : REPO_ROOT;

/** Free's and Pro's shipped loader, gzip -9, per build (ADR 0014, ADR 0029). */
const BYTE_BUDGET = 8192;

const BUNDLES = [
  { label: 'free loader', path: 'public/loader/loader.js', scanForPremium: true },
  { label: 'pro loader', path: 'pro/public/loader/loader.js', scanForPremium: false },
];

const MANIFEST = 'resources/rules/manifest.json';

console.log(`==> check-loader: ${ROOT}`);

const problems = [];

const fail = (message) => problems.push(message);

/**
 * Read a build artifact, or fail closed.
 *
 * An empty file is a failure too: a zero-byte bundle passes a byte budget and
 * contains no premium identifier, which is "clean" for both of the wrong
 * reasons.
 */
function readBundle({ label, path }) {
  const absolute = resolve(ROOT, path);
  let source;

  try {
    source = readFileSync(absolute);
  } catch (error) {
    fail(`${label}: cannot read ${path} (${error.code ?? error.message}) — run the build; nothing was inspected`);
    return null;
  }

  if (source.length === 0) {
    fail(`${label}: ${path} is empty — nothing was inspected, so nothing is proven`);
    return null;
  }

  return source;
}

/**
 * Every rule type the manifest calls premium, across every axis.
 *
 * Read from the manifest rather than listed here, so the scan cannot drift
 * from what the manifest says. Throws rather than returning an empty list when
 * the manifest is unreadable: an empty list scans for nothing and passes.
 */
function premiumIdentifiers() {
  const absolute = resolve(ROOT, MANIFEST);
  const manifest = JSON.parse(readFileSync(absolute, 'utf8'));

  const axes = Object.values(manifest).filter((axis) => axis && typeof axis === 'object');

  if (axes.length === 0) {
    throw new Error(`${MANIFEST} declares no rule axes`);
  }

  return axes.flatMap((axis) =>
    Object.entries(axis)
      .filter(([, entry]) => entry?.tier === 'pro')
      .map(([type]) => type),
  );
}

// Each bundle is read ONCE. Reading again for the premium scan would report a
// missing bundle twice and read as two problems where there is one.
const sources = new Map(BUNDLES.map((bundle) => [bundle.path, readBundle(bundle)]));

// --- 1. The byte budget ------------------------------------------------------

for (const bundle of BUNDLES) {
  const source = sources.get(bundle.path);

  if (source === null) {
    continue;
  }

  const gzipped = gzipSync(source, { level: 9 }).length;
  const verdict = gzipped > BYTE_BUDGET ? '✗' : '✓';

  console.log(`  ${verdict} ${bundle.label}: ${gzipped} B gzipped (budget ${BYTE_BUDGET} B)`);

  if (gzipped > BYTE_BUDGET) {
    fail(`${bundle.label}: ${gzipped} B gzipped exceeds the ${BYTE_BUDGET} B budget by ${gzipped - BYTE_BUDGET} B`);
  }
}

// --- 2. The premium-identifier scan, free's loader only ----------------------

let premium;

try {
  premium = premiumIdentifiers();
} catch (error) {
  fail(`cannot read the rule manifest (${error.message}) — the premium scan inspected nothing`);
  premium = null;
}

if (premium !== null) {
  if (premium.length === 0) {
    // NOT a failure, and NOT a tick either. The manifest is readable and says,
    // truthfully, that nothing in the vocabulary is premium — which was the
    // state while it carried only server-evaluated Targeting entries, and
    // which a future manifest could return to. An empty list scans for
    // nothing, so printing a tick here would report "clean" while asserting
    // nothing, which is the failure ADR 0029 is about. It says so instead.
    console.log('  ! premium scan: the manifest declares no premium rule types, so this scan asserted nothing');
  } else {
    for (const bundle of BUNDLES.filter((b) => b.scanForPremium)) {
      const source = sources.get(bundle.path);

      if (source === null) {
        continue;
      }

      const text = source.toString('utf8');
      const found = premium.filter((identifier) => text.includes(identifier));

      console.log(`  ${found.length === 0 ? '✓' : '✗'} ${bundle.label}: scanned for ${premium.length} premium identifier(s)`);

      for (const identifier of found) {
        fail(`${bundle.label}: contains the premium rule identifier "${identifier}"`);
      }
    }
  }
}

// --- Verdict -----------------------------------------------------------------

if (problems.length > 0) {
  console.error('\n==> check-loader FAILED:');

  for (const problem of problems) {
    console.error(`  ✗ ${problem}`);
  }

  process.exit(1);
}

console.log('  ✓ loader contract clean');
