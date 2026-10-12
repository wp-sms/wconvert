# Release verification — 12 October 2026

Completed after the setup and collection review imports. No hosted release,
merge, remote deployment or external email/SMS delivery was performed.

- `npm run templates:collections:check`: passed with all six current collections.
- Strict `collection-discovery-review.mjs` (without `--candidate`): actual local
  WordPress picker returns all six collection IDs, HTTP 200, without changing
  campaign summaries. [Results](published/discovery.json), [screenshots](published/).
- `bash bin/build.sh all`: passed. Free plus Basic, Pro and Elite ZIPs generated;
  every artifact contract passed. [Artifact sizes and SHA-256](release-artifacts.json).
  ZIP integrity checked; internal review tools and evidence do not ship.
- `npm test -- --maxWorkers=2`: 240 files, 4,364 tests passed. The initial unrestricted
  run during concurrent browser reviews hit two navigation-test timeouts; the
  complete rerun passed with bounded workers and no assertion/test changes.
- `composer test`: 3,018 tests, 17,594 assertions passed.
- `npm run lint`, `npm run typecheck`: passed.
- `npm run test:template-studio`: all 38 passed after review imports.
- `composer verify:templates`: all 107 designs survive registration.
- `git diff --check`: passed.

The imported current review queue has **24 approved / 104 stale** setup reviews
and **six approved collections**. This clears the bundled-collection release gate;
it is not a fresh approval of every template in the plugin. No reviewed item was
left as revise. The 104 others remain an explicit follow-up backlog.

The failure occurred because changes to prepared templates and the shared renderer
invalidated revision-bound setup approvals. Those approvals also participate in
collection revisions, so the collection gate correctly rejected the old snapshots.
The earlier library-polish completion missed this release-finishing step. Keep the
revision/evidence checks strict; use the new maintenance checklist to finish
imports, regeneration, native discovery and packaging before calling work ready.

## Pre-merge integration check

Integrated main `7174c8df` before merging PR #264. The collection gate still
passes with six current approvals. The affected PHP tests for submission recovery
scheduling, content regions/dividers and retention pass: 16 tests, 51 assertions.
The artifact hashes above remain those of the original reviewed build; they are
not presented as newly rebuilt artifacts for this integration commit. CI remains
skipped at the user's request.
