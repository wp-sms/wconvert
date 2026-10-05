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
//   1. THE BYTE BUDGET, HARD. gzip -9: Free 14336 B; Basic 24832 B;
//      Pro 26368 B; Elite 26624 B (ADR 0109), per build. It blocks rather than warns, and there is no
//      second warn band nobody would read.
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
//      AND DO NOT SCAN THE INSPECTOR BUNDLE EITHER, for the admin bundle's
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
const FREE_BYTE_BUDGET = 14592;
// ADR 0103: shared journeys plus paid recovery/content access.
// ADR 0104: user-approved 1 KiB increase for grouped display policies.
// ADR 0108: 256 B for product recovery, then 256 B for path-scoped answer review.
const PAID_BYTE_BUDGET = 25088;
// ADR 0105: the complete shared phone-field seam has measured per-rung caps.
// ADR 0121: server-counted conversion notification adds a bounded renderer seam.
const PRO_BYTE_BUDGET = 26656;
// ADR 0117: +128 B for the commerce bridge; the separately capped runtime loads on demand.
const ELITE_BYTE_BUDGET = 27040;

const MANIFEST = 'resources/rules/manifest.json';

const TIER_MANIFEST = 'tiers.json';

/** Where a module declares itself — its slug, and the token its bundle carries. */
const MODULES = 'pro/modules';

/**
 * The paid rungs, ascending, read from the file that declares them.
 *
 * The ORDER is what every scan below is relative to — "no identifier from a
 * HIGHER rung" is a statement about this list. `WConvert\Support\Tier` spells
 * the same ladder in PHP and `tests/unit/Support/TierManifestTest.php` asserts
 * the two agree, so this reads the data rather than carrying a fourth copy.
 *
 * Throws rather than defaulting: a ladder this cannot read is a set of scans
 * that would each assert nothing and print a tick (ADR 0029, ADR 0056).
 */
function paidTiers() {
  const declared = JSON.parse(readFileSync(resolve(ROOT, TIER_MANIFEST), 'utf8'))?.premium?.tiers;

  if (!Array.isArray(declared) || declared.length === 0) {
    throw new Error(`${TIER_MANIFEST} declares no premium tiers`);
  }

  return declared.map((tier) => {
    if (typeof tier?.slug !== 'string' || tier.slug === '') {
      throw new Error(`${TIER_MANIFEST} declares a tier with no slug`);
    }

    return tier.slug;
  });
}

/**
 * Every bundle this program is responsible for, and what each must not contain.
 *
 * ============================================================================
 * ONE PER TIER, BECAUSE OTHERWISE THE TIER SPLIT IS NOT A GATE (ADR 0056).
 * ============================================================================
 * This listed two bundles while Pro was one build. It lists four, and the three
 * Pro rows are the JavaScript half of the per-tier artifact contract: **a Basic
 * bundle must carry no identifier from a higher rung**, proven in the built
 * bytes rather than in the source that produced them.
 *
 * That assertion is the whole difference between this and WSMS, where all three
 * premium tiers ship a byte-identical `main.js` — so a Basic customer holds the
 * Elite UI behind a client-readable flag. Under possession-gating that is not a
 * weaker gate, it is no gate.
 *
 * `above` is a tier slug: the scan looks for every identifier the manifest
 * files ABOVE that rung. Free's is `null`, meaning above free — which is every
 * paid identifier there is, and the assertion this program has always made.
 */
const BUNDLES = [
  { label: 'free loader', path: 'public/loader/loader.js', above: null },
  { label: 'pro basic loader', path: 'pro/public/tiers/basic/loader/loader.js', above: 'basic' },
  { label: 'pro pro loader', path: 'pro/public/tiers/pro/loader/loader.js', above: 'pro' },
  { label: 'pro elite loader', path: 'pro/public/loader/loader.js', above: 'elite' },
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
 * Every rule type the manifest files at each paid rung, across every axis.
 *
 * Read from the manifest rather than listed here, so the scan cannot drift from
 * what the manifest says. Throws rather than returning an empty map when the
 * manifest is unreadable: an empty map scans for nothing and passes.
 *
 * **Keyed by rung rather than filtered to one word**, and that was a live hole
 * rather than a tidy-up: this read `entry.tier === 'pro'`, so the moment the
 * two cart Conditions moved to `elite` (ADR 0056) free's loader stopped being
 * scanned for them at all — the check would have gone on printing a tick while
 * asserting less than it said.
 *
 * An entry declaring a rung `tiers.json` does not is a failure here rather than
 * an identifier quietly dropped from every scan.
 *
 * @returns {Map<string, string[]>} tier slug => the identifiers filed at it.
 */
function identifiersByTier(tiers) {
  const absolute = resolve(ROOT, MANIFEST);
  const manifest = JSON.parse(readFileSync(absolute, 'utf8'));

  const axes = Object.values(manifest).filter((axis) => axis && typeof axis === 'object');

  if (axes.length === 0) {
    throw new Error(`${MANIFEST} declares no rule axes`);
  }

  const byTier = new Map(tiers.map((tier) => [tier, []]));

  for (const axis of axes) {
    for (const [type, entry] of Object.entries(axis)) {
      const tier = entry?.tier ?? 'free';

      if (tier === 'free') {
        continue;
      }

      if (!byTier.has(tier)) {
        throw new Error(`${MANIFEST}: ${type} is filed at "${tier}", which ${TIER_MANIFEST} does not declare`);
      }

      byTier.get(tier).push(type);
    }
  }

  return byTier;
}

/**
 * Every module MARKER filed at each paid rung.
 *
 * =============================================================================
 * THE SCAN ABOVE CAN ONLY SEE A MODULE WHOSE CONTRIBUTION IS A RULE.
 * =============================================================================
 * `identifiersByTier` reads its list out of the rule manifest, which is right
 * and is also the whole of its reach. `ab-testing` is the first module that
 * ships loader code and declares no rule type at all — its contribution is a
 * payload narrowing — so a Basic bundle carrying its entire arm-drawing routine
 * would have passed every check there is, which is precisely the
 * byte-identical-JavaScript failure ADR 0056 measures WSMS by, arriving through
 * a gap in the scan instead of through a flag.
 *
 * So a module may declare a `bundle_marker` in its own `module.json` — a token
 * that appears in its built JavaScript and in no lower rung's. It sits beside
 * the slug that already names the module, so the premium split still adds zero
 * new lists (ADR 0015), and a module that declares none is reported as
 * unscanned rather than ticked.
 *
 * @returns {{byTier: Map<string, string[]>, unscanned: Map<string, string[]>}}
 *   tier slug => the markers of modules it first ships, and the slugs of the
 *   modules it first ships that declare none.
 */
function markersByTier(tiers) {
  const byTier = new Map(tiers.map((tier) => [tier, []]));
  const unscanned = new Map(tiers.map((tier) => [tier, []]));
  const ladder = JSON.parse(readFileSync(resolve(ROOT, TIER_MANIFEST), 'utf8'))?.premium?.tiers ?? [];

  for (const file of readdirSync(resolve(ROOT, MODULES), { withFileTypes: true })) {
    if (!file.isDirectory()) {
      continue;
    }

    const manifest = resolve(ROOT, MODULES, file.name, 'module.json');
    const declared = JSON.parse(readFileSync(manifest, 'utf8'));
    const marker = declared?.bundle_marker;

    // The LOWEST rung that ships it, which is the direction the whole ladder
    // is read in: a module on disk is evidence of at least that rung.
    const at = ladder.find((tier) => (tier?.modules ?? []).includes(declared.slug))?.slug;

    if (!byTier.has(at)) {
      throw new Error(`${declared.slug} is shipped by no tier ${TIER_MANIFEST} declares`);
    }

    // **A module that declares none is NAMED rather than passed over.** A tick
    // printed beside a scan that skipped three modules reports "clean" while
    // asserting less than it says, which is the failure ADR 0029 is about —
    // and it is the failure that would hide the next module to ship loader
    // code and no rule type, exactly as `ab-testing` did.
    (typeof marker === 'string' && marker !== '' ? byTier : unscanned).get(at).push(
      typeof marker === 'string' && marker !== '' ? marker : declared.slug,
    );
  }

  return { byTier, unscanned };
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

  const BYTE_BUDGET = bundle.above === 'elite' ? ELITE_BYTE_BUDGET : bundle.above === 'pro' ? PRO_BYTE_BUDGET : bundle.path.startsWith('pro/') ? PAID_BYTE_BUDGET : FREE_BYTE_BUDGET;
  const gzipped = gzipSync(source, { level: 9 }).length;
  const verdict = gzipped > BYTE_BUDGET ? '✗' : '✓';

  console.log(`  ${verdict} ${bundle.label}: ${gzipped} B gzipped (budget ${BYTE_BUDGET} B)`);

  if (gzipped > BYTE_BUDGET) {
    fail(`${bundle.label}: ${gzipped} B gzipped exceeds the ${BYTE_BUDGET} B budget by ${gzipped - BYTE_BUDGET} B`);
  }
}

// --- 2. The identifier scan: NO BUNDLE CARRIES A HIGHER RUNG'S RULES ---------
//
// Free's is the assertion this program was written for — free's built loader
// contains neither premium identifier, which is what makes ADR 0015's "the
// absence that matters is the CODE's" an assertion rather than a sentence. The
// three Pro rows are the same assertion one rung finer, and they are what stop
// a per-tier build being theatre (ADR 0056).

let byTier = null;
let markers = null;
let tiers = null;

try {
  tiers = paidTiers();
  byTier = identifiersByTier(tiers);
} catch (error) {
  fail(`cannot read the tier ladder or the rule manifest (${error.message}) — the identifier scan inspected nothing`);
}

let unscanned = null;

try {
  const read = tiers === null ? null : markersByTier(tiers);

  markers = read === null ? null : read.byTier;
  unscanned = read === null ? null : read.unscanned;
} catch (error) {
  fail(`cannot read the module manifests (${error.message}) — the marker scan inspected nothing`);
}

if (byTier !== null) {
  for (const bundle of BUNDLES) {
    const source = sources.get(bundle.path);

    if (source === null) {
      continue;
    }

    // Everything filed ABOVE this bundle's rung. For free that is every paid
    // identifier; for elite it is nothing, because there is nothing above it.
    const from = bundle.above === null ? 0 : tiers.indexOf(bundle.above) + 1;
    const forbidden = tiers.slice(from).flatMap((tier) => byTier.get(tier));

    if (forbidden.length === 0) {
      // NOT a failure, and NOT a tick either. The manifest is readable and
      // says, truthfully, that there is nothing above this rung to look for —
      // which is the top rung's permanent state, and which was the whole
      // vocabulary's state while it carried only server-evaluated Targeting
      // entries. An empty list scans for nothing, so printing a tick here
      // would report "clean" while asserting nothing, which is the failure
      // ADR 0029 is about. It says so instead.
      console.log(`  ! ${bundle.label}: nothing is filed above its rung, so this scan asserted nothing`);
      continue;
    }

    const text = source.toString('utf8');
    const found = forbidden.filter((identifier) => text.includes(identifier));

    console.log(
      `  ${found.length === 0 ? '✓' : '✗'} ${bundle.label}: scanned for ${forbidden.length} identifier(s) from a higher rung`,
    );

    for (const identifier of found) {
      fail(`${bundle.label}: contains "${identifier}", which is filed above the rung this bundle ships`);
    }
  }
}

// --- 3. The marker scan: NO BUNDLE CARRIES A HIGHER RUNG'S MODULE -----------
//
// The same assertion for a module that ships no rule type, and therefore has
// nothing in the rule manifest for the scan above to look for. See
// `markersByTier` for why that gap is worth closing rather than noting.

if (markers !== null) {
  for (const bundle of BUNDLES) {
    const source = sources.get(bundle.path);

    if (source === null) {
      continue;
    }

    const from = bundle.above === null ? 0 : tiers.indexOf(bundle.above) + 1;
    const above = tiers.slice(from);
    const forbidden = above.flatMap((tier) => markers.get(tier));
    const silent = above.flatMap((tier) => unscanned.get(tier));

    if (forbidden.length === 0) {
      console.log(`  ! ${bundle.label}: no module above its rung declares a marker, so this scan asserted nothing`);
    } else {
      const text = source.toString('utf8');
      const found = forbidden.filter((marker) => text.includes(marker));

      console.log(
        `  ${found.length === 0 ? '✓' : '✗'} ${bundle.label}: scanned for ${forbidden.length} module marker(s) from a higher rung`,
      );

      for (const marker of found) {
        fail(`${bundle.label}: contains "${marker}", a module filed above the rung this bundle ships`);
      }
    }

    // Said out loud beside the tick, never folded into it: a module above this
    // rung that declares no marker is one this scan did not look for, and a
    // reader has to be able to tell that from a rung with nothing above it.
    if (silent.length > 0) {
      console.log(`  ! ${bundle.label}: ${silent.join(', ')} declare no marker and were not scanned for`);
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
