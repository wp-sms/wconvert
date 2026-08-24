# The free loader source carries no premium code

Premium rule modules live under **Pro's own tree**, and Pro's loader entry imports
free's modules plus its own. There is **no mode flag and no tree-shaking**: dead
premium code never enters the free build because it was never in free's source.

This amends [ADR 0014](0014-pro-replaces-the-loader.md), whose first consequence
said "one loader source, two Vite builds, tree-shaken on a mode flag", and the
`exit_intent` row of [ADR 0015](0015-enforcement-is-by-non-registration.md)'s table,
which said "code the free build tree-shakes out". Everything else in both survives:
Pro still *replaces* the loader, still dequeues free's in PHP, and the budget still
applies per build.

## Why the mode flag could not stand

**wp.org Guideline 4 and Guideline 9 are only compatible if the source is honestly
free-only.** The repo is private, so un-minified sources for the shipped loader must
be made available. Under the mode flag, free's un-minified loader source contains
`exit_intent`, `scroll_up` and every premium condition — so publishing it to satisfy
Guideline 4 would ship premium code inside the free artifact, which is exactly what
Guideline 9 and 0015's "absence is the compliance position" forbid. Satisfying one
obligation by breaking the other is not a choice between them; it is a design that
cannot ship.

**And tree-shaking is an optimisation, not a guarantee.** It depends on a
`sideEffects` field, on purity annotations, and on the bundler's ability to prove a
branch dead — any of which a dependency bump can quietly change. 0015 rests the
entire premium position on absence being *real*. A compliance property whose proof
is "the bundler probably eliminated it" is not absence; it is a bet.

## Consequences

- **The shared engine's module boundary is drawn on day one**, deliberately, rather
  than deferred behind a flag. This is the cost, and it is the whole cost.
- **Pro's entry is free's modules plus Pro's**, which is the same composition
  0014 already describes at the plugin level, applied one layer down.
- **Free's un-minified sources ship inside the free ZIP**, which is what makes the
  readme's source claim true by construction. WSMS's `.distignore` strips
  `/resources` while its readme still says sources ship there — the trap this
  deletes rather than inherits.
- **One invariant now covers source and bundle both.** "No file in free's tree
  imports a `pro/` path" is checkable without a build and is what
  [ADR 0029](0029-the-free-contract-is-proven-at-the-source.md) runs on every pull
  request. Under the mode flag that check was impossible — the import was legitimate
  and the guarantee lived in the bundler.
