# Main integration verification — 20 October 2026

Prepared on `codex/design-only-gallery-contract` from main commit `305e44ed` in a separate worktree. The original checkout remains on its existing branch and all 101 pre-existing modified/untracked file contents were preserved byte-for-byte. No admin UI, plugin readme, licence handling, origin validation, publishing-retention logic, or unrelated operational changes were copied into this PR.

The existing main already contains the complete reviewed template sources, eight-pack plan, strict origin validation and the exact three allowed origins. Those files remain unchanged. Only the new catalogue projection, design-only preview generation, associated verification tools, consumer example, contract and publication evidence were added.

## Review

The repository's two-axis code review found no specification mismatch and no documented standards violation. One audit bug was fixed: the live inventory must combine `designs` and `extensions.bundled_designs`, just like the candidate. Otherwise a subsequent audit of this published release would incorrectly report 32 live designs and 92 missing designs. The corrected command was exercised against the published release as both baseline and candidate: 50 live, 74 missing, zero approved designs omitted, zero removed designs, and all eight pack digests unchanged.

## Checks on the integrated branch

- Built the renderer/pilot from current main sources: 124 designs and 148 setups.
- All 18 targeted publisher, catalogue, preview and consumer-example tests passed.
- All 49 Worker/service tests passed, including current main's stricter origin tests.
- Worker types, TypeScript, dry-run build, PHP syntax and diff checks passed.
- Repeated Chromium/Workerd acceptance against the published release using the integrated service: 50 designs, five formats, 50 decoded thumbnails, nine gallery collections, 180 focused screen/device checks, 360 design-only direct/fragment checks, 15 keyboard scroll checks, three accepted parent origins, one blocked origin, zero page errors.
- Existing live HTTPS and disposable WordPress acceptance evidence remains in this directory. This integration does not republish the release or change its bytes.

Pull request: https://github.com/wp-sms/wconvert/pull/305
GitHub CI is the final merge gate; its result is recorded on the pull request.
