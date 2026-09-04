# The tier ladder is a manifest, and a module is a directory

[[Pro]] is **one plugin at three tiers** — `basic`, `pro`, `elite` — declared in
`tiers.json` at the root of free's tree. A **module** is a directory under
`pro/modules/` holding its own `module.json`; a tier's build is the full Pro tree
with the module directories that tier does not ship **deleted**; and the tier an
install is running at is **inferred from the modules on disk**, never stored.

One tier is sold. All three are built, and all three display as **"Pro"**.

## Why now, when one product ships

Everything here is cheap today and expensive once free 0.1.0 is on wp.org.

`Tier` was two cases and `ProPresence::isLoaded()` returned a `bool`, so
[`Availability::of()`](../../src/Support/Availability.php) took a three-valued
question and could only be handed a two-valued answer. Adding a rung after
launch is not an enum case: it is every `tier:` value in the rule manifest, in
`locked.json` and on every [[Goal]] — which are **saved records on live
installs** — plus every upsell card that currently says the word "Pro" in a
string. [ADR 0015](0015-enforcement-is-by-non-registration.md) always described
the accessor as *"headroom for a future tier ladder"*; it was a boolean, so the
headroom was rhetorical.

So the values are real slugs from day one and the display name is data. **At
launch every rung's `name` is "Pro"**, and splitting the range later is an edit
to `tiers.json` — not a code change, and not a data migration.

## The ladder is spelled twice, on purpose

| | Where | Why there |
|---|---|---|
| The **order** | [`Tier::ladder()`](../../src/Support/Tier.php), in code | `Tier::includes()` reads no file, so the ordering cannot fail open however badly a build goes wrong |
| The **display name** and the **module set** | `tiers.json`, in data | Only a file can carry the words a merchant reads and what a per-tier build cuts to |

That split is somebody else's bug, avoided. ADR 0015 already records WSMS's
cautionary case: *"its shipped elite ZIP is missing the `tiers.json` its own
`TierGate` reads, benign only because every lookup fails open — and a ladder that
fails open is not a ladder."* Here every unreadable state resolves **downward**:
no file, no modules, or modules nothing claims, and a loaded Pro reads as the
**bottom** paid rung. Reading it as free would show a paying customer upsell
cards for what they bought ([ADR 0026](0026-a-goal-the-site-cannot-serve-is-hidden.md));
reading it as elite would offer them a feature their ZIP does not contain. The
bottom rung is the only answer wrong in the recoverable direction.

`tests/unit/Support/TierManifestTest.php` asserts the two spellings agree, and
`bin/verify-artifact-contract.sh` requires `tiers.json` in the free ZIP — so the
file WSMS lost cannot go missing here without a red release.

## A module is a directory, and that is what makes the cut provable

Everything under `pro/modules/<slug>/` is that module — its PHP, its loader
source, its designs — and nothing outside it is. Three things follow, and each
replaces machinery one of the reference products maintains by hand:

- **Withholding a module is `rm -rf`**, not a `@build-strip-free-*` marker and
  not a build-time denylist checked against a remote catalogue.
- **The installed tier is inferred**, the way WP Statistics'
  `TierGate::installedTier()` does: each module on disk is evidence of at least
  the rung that first ships it, and the build is the highest such rung. It is
  spoof-resistant downward by construction — claiming a lower tier costs you the
  modules — and it needs no new storage, which matters given CLAUDE.md's
  sign-off rule.
- **The artifact contract is not told which tier it is inspecting.** It infers,
  the same way, so no `--basic` flag exists to be passed to the wrong tree —
  [ADR 0029](0029-the-free-contract-is-proven-at-the-source.md)'s rule about the
  gate having no opt-outs, one level down.

**Every rung names its modules, including the top one — there is no `"*"`.** The
contract asserts two things: that a rung carries no module it does not declare,
*and* that it carries every module it does. Against a wildcard the second half
asserts nothing, which would leave the rung every customer buys today as the one
rung with no completeness check. The cost is that a new module must be added to
each rung that ships it, and that cost is paid loudly.

## The JavaScript half, which is the one that is usually skipped

`bin/verify-artifact-contract.sh` and `bin/check-loader.mjs` both assert that
**no bundle carries a rule identifier filed above its rung**, in the built bytes.

*Completed by [ADR 0058](0058-a-test-ends-when-the-merchant-says-so.md), which
found the hole in that sentence by being the first thing to fall through it.
The identifier list is read out of the RULE MANIFEST, so the scan can only see
a module whose contribution is a **rule** — and `ab-testing` ships loader code
and declares no rule type at all, its contribution being a payload narrowing.
A Basic bundle carrying the entire arm-drawing routine would therefore have
passed every check on this page, which is the byte-identical failure this
section measures WSMS by, reached through a gap in the scan instead of through
a flag. So a module may declare a `bundle_marker` in its own `module.json` — a
token that appears in its built JavaScript and in no lower rung's — beside the
slug that already names it, and both programs scan for it exactly as they scan
for an identifier. **A module that declares none is reported as unscanned
rather than ticked**, which is the same rule the identifier scan already
follows when nothing is filed above a rung.*

This is measured rather than assumed, and the measurement is why it is here. WP
Statistics ships 2.2 MB at basic against 3.3 MB at elite. **WSMS ships a
byte-identical `main.js` at all three of its tiers** (md5 `3b2f2137…`), so a
Basic customer holds the Elite React UI behind a client-readable flag. Under
possession-gating that is not a weaker gate, **it is no gate** — and
possession-gating is the whole of ADR 0015.

The mechanism is [ADR 0028](0028-the-free-loader-source-carries-no-premium-code.md)'s,
applied a rung down: **one entry per tier, in source, and no build flag
anywhere.** A `define()` would put every tier's code in every tier's bundle and
ask the bundler to hide it, which is precisely the shape being refused. Rollup's
tree-shaking then does the work: free 7,337 B, basic 8,146 B, pro 8,499 B, elite
8,687 B gzipped, and `basic/loader.js` contains no premium identifier at all.

## What is NOT changed

**There is still no runtime licence check anywhere.** ADR 0015 is unamended on
that point: the tiers differ by which features are present, never by a limit
inside the plugin. The build is the gate, Nexus serves the tier-matched ZIP, and
a licence governs updates and support only.

`WCONVERT_MIN_CORE` remains **one constant across all three tiers** — see
[ADR 0030](0030-free-and-pro-release-on-independent-tags.md). Pro makes exactly
one statement about free, and it is the same statement at every rung.

## Consequences

- **`bin/build.sh pro` produces three ZIPs, and CI builds all three even though
  one ships.** Machinery that is not exercised rots, and the release that first
  needs a per-tier build is the release nobody can wait for. Three ZIPs cost
  seconds.
- **The top-level directory inside every Pro ZIP is `wconvert-pro`**, at every
  rung. They are one plugin at three tiers, so moving up replaces an install
  rather than adding a second beside it; only the ZIP's file name carries the
  tier, which is what Nexus matches a licence against.
- **Pro's provider registers the rule types for each rung it supplies**, walking
  `Tier::paid()` and stopping where the installed tier stops. It still names no
  rule type: it asks the one manifest both plugins read for the types filed at
  each rung, so the premium split still adds **zero new lists** (ADR 0015).
- **The admin bundle is one build shared by all three rungs**, and that is honest
  only while Pro's admin adds no screen of its own — nothing is being withheld
  from anybody, which is the distinction from WSMS's identical `main.js`.
  `pro/tests/js/admin-entry.test.ts` fails on the pull request that adds the
  first premium screen and says to split the build per rung.
  *Still true after A/B testing shipped, and it was worth checking:
  `pro/resources/admin/src/screens.tsx` expected A/B to be "the first thing to
  land here" and it did not. Starting a test and ending one are two ROW ACTIONS
  on free's existing Optins list, drawn from the same `locked`-state data every
  other premium capability is drawn from ([ADR 0015](0015-enforcement-is-by-non-registration.md)),
  and the arms nest inside the list free already renders. `PRO_SCREENS` is
  still empty, the tripwire has not fired, and no admin build was split
  ([ADR 0058](0058-a-test-ends-when-the-merchant-says-so.md)).*
- **`public/tiers/` is repository scaffolding and ships in nothing.** The top
  rung builds to the canonical `pro/public/{loader,inspector}` so a source
  checkout runs the whole product; the other two land under `public/tiers/`, and
  the build moves the rung's bundle into place and deletes the directory. A
  staged tree that still has one fails the contract — leaving it would put every
  other rung's bundle inside this rung's ZIP, which is the byte-identical
  failure arriving through the build instead of through a flag.
