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
//   1. THE BYTE BUDGET, HARD. gzip -9 on Node 22: Free 18672 B; Pro 32064 B
//      (ADR 0139, amended; ADR 0146; ADR 0152; ADR 0155; ADR 0158; ADR 0159), per build. It blocks rather than warns,
//      and there is no second warn band nobody would read.
//
//      IT WAS 8192, AND THE NUMBER MOVED ONCE, ON PURPOSE. The original was
//      set at 2x the prototype's 3.9KB, against a vocabulary of six leaves and
//      three layouts that produced twelve designs reading as one design twelve
//      times. Widening it — style tokens, a wrapping grid, four small leaves,
//      an icon set, motion, a countdown — costs about 2KB and does not fit
//      under 8192 beside Pro's two extra containers. See ADR 0014 and ADR 0029
//      for the amendment and the competitor figures behind it; in short, the
//      smallest shipped runtime in the field is Icegram Lite at 13,672 B, so a
//      ceiling below that keeps "smaller than anything in the market"
//      literally sayable while leaving the gallery and container behavior room
//      to be real. ADR 0095 records the later 512 B placement amendment;
//      ADR 0098 adds the shared modal lifecycle and Pro fullscreen surface.
//      ADR 0099 adds 512 B for automatic inline selection/manual precedence.
//
//      WHAT DID NOT CHANGE IS THAT IT IS HARD AND FLAGLESS (ADR 0029). A
//      number moved with an argument attached is not an opt-out; the moment
//      this check has one, the opt-out is what runs on the day it matters.
//
//   2. THE PREMIUM-IDENTIFIER SCAN, SCOPED TO FREE'S LOADER BUNDLE ONLY. Its
//      identifier list is read from the rule manifest, so it cannot drift from
//      what the manifest calls premium — and beside it, every module's
//      declared `bundle_marker`, for the modules that ship no rule type.
//
//      DO NOT SCAN THE ADMIN BUNDLE FOR IDENTIFIERS. Free's admin bundle
//      contains premium identifiers ON PURPOSE — the data-only catalogue of
//      premium Destination types, and the Pro hints that name Pro's rules
//      (ADR 0147). Free's loader never renders an upsell, so it has no such
//      excuse. Same rule, two bundles, opposite verdicts; WSMS's own script
//      warns against exactly the unscoped version. What free's admin and
//      inspector may not carry is Pro's admin CODE, and `bin/check-admin.mjs`
//      proves that with each module's `admin_markers` (ADR 0147).
//
//      AND DO NOT SCAN THE INSPECTOR BUNDLE HERE EITHER, for the admin bundle's
//      reason rather than the loader's. `public/inspector/inspector.js` is
//      admin-gated and parameter-gated (ADR 0048): it is enqueued only for a
//      merchant holding `manage_options` who asked for it by name, never for a
//      visitor. Its whole job is to EXPLAIN, which on a free install includes
//      naming the premium rule types this site cannot run — the same honest
//      upsell the admin bundle carries. Scanning it would fail the build on
//      the feature working correctly.
//
//      It is not exempt from everything: `bin/verify-artifact-contract.sh`
//      requires it in both ZIPs, and `tests/js/inspector-parity.test.ts` walks
//      the import graph from each LOADER entry and asserts it never reaches
//      `inspect/` — which is what keeps the budget below honest.
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
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = process.argv[2] ? resolve(process.argv[2]) : REPO_ROOT;

/**
 * Free's and Pro's shipped loader, gzip -9, per build (ADR 0014 amended,
 * ADR 0029 amended).
 *
 * The eligibility inspector carries no budget and is not listed below. The
 * limit is about what every visitor of every matching page downloads, and that
 * bundle is enqueued only for an administrator who asked for it.
 */
// ADR 0111: 256 B per rung for pre-capture verification after ADR 0110 events.
// ADR 0124: Node 22 gzip normalization, +32 B; Free asset is byte-identical.
// ADR 0139 amendment (2026-10-12, approved by Mostafa): +96 B, measured on Node 22.
// ADR 0152 (approved by the user): +48 B for the code block's apply link, measured on Node 22.
// ADR 0155: +128 B Free / +160 B Pro for font-independent shared controls.
// ADR 0159 (approved by the user): +2560 B headroom, so a small addition no
// longer needs its own yes; the styled close, error and countdown used 413 B (15,309 B).
// ADR 0167: +1024 B for fixed SVG actions, ticket cutouts and bounded campaign artwork.
// ADR 0168: +192 B for approved divider/code/text controls and aligned forms.
const FREE_BYTE_BUDGET = 18672;
// ADR 0117: +128 B for the commerce bridge; the separately capped runtime loads on demand.
// ADR 0139: user-approved +32 B for "is not" and the cart bridge's known().
// ADR 0139 amendment (2026-10-12, approved by Mostafa): +64 B, measured on Node 22.
// ADR 0146: Pro is one tier, so this is the old top rung's budget, unchanged.
// ADR 0158 (approved by the user, PR #314): +288 B for the close reserve on bars
// and slide-ins, measured on Node 22; main left 48 B, the reserve needs ~245 B.
// ADR 0159 (approved by the user): +2560 B headroom, as Free; this PR used 496 B (28,656 B).
// ADR 0168: +128 B for opt-in compact composition and minute/vertical countdowns.
const PRO_BYTE_BUDGET = 32064;

const MANIFEST = 'resources/rules/manifest.json';

/** Where a module declares itself — its slug, and the token its bundle carries. */
const MODULES = 'pro/modules';

/**
 * Every bundle this program is responsible for.
 *
 * `scan` is whether the premium scans run against it. Only free's do: Pro's
 * loader IS the premium code (ADR 0146), so scanning it for premium code would
 * assert nothing.
 */
const BUNDLES = [
  { label: 'free loader', path: 'public/loader/loader.js', budget: FREE_BYTE_BUDGET, scan: true },
  { label: 'pro loader', path: 'pro/public/loader/loader.js', budget: PRO_BYTE_BUDGET, scan: false },
];

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
 * Every rule type the manifest files at a paid tier, across every axis.
 *
 * Read from the manifest rather than listed here, so the scan cannot drift from
 * what the manifest says. Throws rather than returning an empty list when the
 * manifest is unreadable: an empty list scans for nothing and passes.
 *
 * **Anything not `free`, rather than the word "pro"**, so renaming the tier
 * cannot quietly stop free's loader being scanned at all.
 *
 * @returns {string[]}
 */
function premiumIdentifiers() {
  const manifest = JSON.parse(readFileSync(resolve(ROOT, MANIFEST), 'utf8'));
  const axes = Object.values(manifest).filter((axis) => axis && typeof axis === 'object');

  if (axes.length === 0) {
    throw new Error(`${MANIFEST} declares no rule axes`);
  }

  return axes.flatMap((axis) => Object.entries(axis).filter(([, entry]) => (entry?.tier ?? 'free') !== 'free').map(([type]) => type));
}

/**
 * Every module MARKER Pro's modules declare.
 *
 * =============================================================================
 * THE SCAN ABOVE CAN ONLY SEE A MODULE WHOSE CONTRIBUTION IS A RULE.
 * =============================================================================
 * `premiumIdentifiers` reads its list out of the rule manifest, which is right
 * and is also the whole of its reach. `ab-testing` ships loader code and
 * declares no rule type at all — its contribution is a payload narrowing — so
 * free's bundle carrying its entire arm-drawing routine would pass that scan.
 *
 * So a module may declare a `bundle_marker` in its own `module.json` — a token
 * that appears in its built JavaScript and in free's never. It sits beside the
 * slug that already names the module, so the premium split still adds zero new
 * lists (ADR 0015), and a module that declares none is reported as unscanned
 * rather than ticked.
 *
 * @returns {{markers: string[], unscanned: string[]}}
 */
function moduleMarkers() {
  const markers = [];
  const unscanned = [];

  for (const file of readdirSync(resolve(ROOT, MODULES), { withFileTypes: true })) {
    if (!file.isDirectory()) {
      continue;
    }

    const declared = JSON.parse(readFileSync(resolve(ROOT, MODULES, file.name, 'module.json'), 'utf8'));
    const marker = declared?.bundle_marker;

    // **A module that declares none is NAMED rather than passed over.** A tick
    // printed beside a scan that skipped three modules reports "clean" while
    // asserting less than it says, which is the failure ADR 0029 is about.
    if (typeof marker === 'string' && marker !== '') {
      markers.push(marker);
    } else {
      unscanned.push(declared.slug);
    }
  }

  return { markers, unscanned };
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
  const verdict = gzipped > bundle.budget ? '✗' : '✓';

  console.log(`  ${verdict} ${bundle.label}: ${gzipped} B gzipped (budget ${bundle.budget} B)`);

  if (gzipped > bundle.budget) {
    fail(`${bundle.label}: ${gzipped} B gzipped exceeds the ${bundle.budget} B budget by ${gzipped - bundle.budget} B`);
  }
}

// --- 2. The identifier scan: FREE'S LOADER CARRIES NO PREMIUM RULE ----------
//
// The assertion this program was written for — free's built loader contains no
// premium identifier, which is what makes ADR 0015's "the absence that matters
// is the CODE's" an assertion rather than a sentence.

let identifiers = null;

try {
  identifiers = premiumIdentifiers();
} catch (error) {
  fail(`cannot read the rule manifest (${error.message}) — the identifier scan inspected nothing`);
}

let modules = null;

try {
  modules = moduleMarkers();
} catch (error) {
  fail(`cannot read the module manifests (${error.message}) — the marker scan inspected nothing`);
}

for (const bundle of BUNDLES.filter(({ scan }) => scan)) {
  const source = sources.get(bundle.path);

  if (source === null) {
    continue;
  }

  const text = source.toString('utf8');

  if (identifiers !== null) {
    if (identifiers.length === 0) {
      // NOT a failure, and NOT a tick either: an empty list scans for nothing,
      // so printing a tick here would report "clean" while asserting nothing,
      // which is the failure ADR 0029 is about. It says so instead.
      console.log(`  ! ${bundle.label}: nothing is filed as premium, so this scan asserted nothing`);
    } else {
      const found = identifiers.filter((identifier) => text.includes(identifier));

      console.log(`  ${found.length === 0 ? '✓' : '✗'} ${bundle.label}: scanned for ${identifiers.length} premium identifier(s)`);

      for (const identifier of found) {
        fail(`${bundle.label}: contains "${identifier}", which is filed as premium`);
      }
    }
  }

  // --- 3. The marker scan: FREE'S LOADER CARRIES NO PRO MODULE --------------
  //
  // The same assertion for a module that ships no rule type, and therefore has
  // nothing in the rule manifest for the scan above to look for.
  if (modules !== null) {
    if (modules.markers.length === 0) {
      console.log(`  ! ${bundle.label}: no module declares a marker, so this scan asserted nothing`);
    } else {
      const found = modules.markers.filter((marker) => text.includes(marker));

      console.log(`  ${found.length === 0 ? '✓' : '✗'} ${bundle.label}: scanned for ${modules.markers.length} module marker(s)`);

      for (const marker of found) {
        fail(`${bundle.label}: contains "${marker}", a Pro module's marker`);
      }
    }

    // Said out loud beside the tick, never folded into it.
    if (modules.unscanned.length > 0) {
      console.log(`  ! ${bundle.label}: ${modules.unscanned.join(', ')} declare no marker and were not scanned for`);
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
