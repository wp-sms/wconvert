# Build gates and artifact contract

Type: grilling
Status: open
Blocked by: 07, 13

## Question

What must pass before a WConvert artifact ships, and what fails the build?

Graduated from the map's fog ("Performance budget enforcement") by [Premium SDK and
build split](07-premium-sdk-and-build-split.md) and [wp.org rules for freemium and
remote libraries](06-wporg-rules-for-freemium-and-remote-libraries.md), which between
them turned "how is the <15KB budget held" into a broader and now-answerable question:
there are several independent things a build must guarantee, and one gate mechanism
can hold all of them.

The four guarantees, and what each ticket established:

1. **The front-end budget.** <15KB gzipped is decided; the enforcement is not. What
   is measured — the loader alone, or loader + inlined payload? What is the failure
   threshold versus a warning? 07 notes WSMS's artifact-size heuristic proved a weak
   tell in practice (measured ~87 KB against a documented ~150 KB), so a real byte
   assertion beats eyeballing.
2. **The free-artifact contract.** 06 makes this a compliance matter, not hygiene: no
   premium code, no licence field, no SDK, no update-checker may reach the free ZIP.
   07 found WSMS's fail-closed `bin/verify-free-contract.sh` (7 checks); its check 7 —
   no free React source may import a `premium/` path — is drift-proof by construction
   and is the pattern to rebuild on day one.
3. **The bundle-identity check.** 07's `main.js` trap: two Vite configs writing one
   output path with `emptyOutDir`, where the failure is silent and presents as
   "couldn't load" rather than as a visible upsell. Whatever WConvert does instead
   still needs an assertion that the shipped bundle is the bundle intended.
4. **Plugin Check.** 06 found it now runs on **every release**, not just submission
   (since 2025-10-27), which raises the cost of deferred cleanup and argues for
   running it locally in the same gate.

Open:

- **Where the gate lives** — pre-commit, CI, or the release script only. Each catches
  drift at a different cost.
- **Whether the gate is one script or several**, and whether it is fail-closed
  (WSMS's is; that property is most of its value).
- **The minified-sources obligation** (Guideline 4). If the repo is private, un-minified
  sources must ship inside the ZIP; if public, a readme link suffices. 06 says pick
  deliberately and record it — that choice belongs here because it changes the artifact.
- **What a budget failure does to a PR** — block, or report and let a human judge.
