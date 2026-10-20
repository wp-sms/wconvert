# Integrated templates and gallery — 20 October 2026

This combines PRs #301–#303 with the other agent’s public design gallery, operational backup/recovery, rate limits, and connection-disclosure work. The original local checkout was copied without modifying its uncommitted files. The user confirmed merging into main and skipping CI.

## Publication safety

The fresh local release contains eight packs, 35 setups, 32 designs, 56 screens/results, and six collections. All eight pack payload hashes, access tiers and versions exactly match the current live catalogue. See `live-pack-baseline.json` and `release.json`. The sixteen creative/expressive additions from #302/#303 remain bundled/studio candidates; they are not silently added to hosted packs.

Remote publishing now verifies current page hashes and refuses missing live pack IDs before uploading. Intentional removal/rollback requires an exact repeated `--remove-pack ID` list. Existing compare-and-swap promotion remains in place. Tests cover eight-to-six refusal with no writes, incomplete/extra acknowledgements, additions, intentional rollback, corrupt pages, concurrency and retries. The local recovery rehearsal explicitly records each intentional historical removal; production never auto-acknowledges removals.

## Embedding and review findings

The Worker allows exactly `https://wconvert.io`, `https://www.wconvert.io`, and `https://dev.wconvert-website.pages.dev`. Wildcard, semicolon, HTTP, path and credential-bearing configurations fail closed. The allowlist does not permit arbitrary Pages branches or localhost. Browser acceptance verifies all three approved parents and refuses an unrelated one.

The two-axis review found and fixed wildcard hostname acceptance and a backup destination check that depended on the script living inside WordPress. Backups now inspect canonical destination ancestors, including symlink destinations, even from a worktree. The review also caught the intentional-rollback rehearsal needing explicit pack removals; that is fixed and rehearsed.

## Validation

- Worker type check and dry-run bundle pass; 49 service tests pass.
- 50 studio tests pass, including catalogue and publisher tests.
- 112 browser checks cover every hosted screen/result on desktop and mobile. All 32 JPEGs decode at their declared dimensions. Three allowed parents, one blocked parent, zero page errors. See `gallery-acceptance.json`.
- Representative desktop and phone screenshots inspected. Native WordPress renders the new Citrus sunrise design using local artwork; detailed prior WordPress/mobile evidence remains with the creative and expressive batches.
- Source contract and all 124 authored template registrations pass.
- PHP: 3,507 tests / 20,329 assertions pass.
- The first full JavaScript run exposed an existing assertion racing a React effect in the empty campaign list. The assertion now waits for the actual callback; the focused 59-test file passes. Final full run: 4,542 tests across 255 files pass. Production assets rebuild successfully; `bash bin/build.sh all` writes the Free and Pro ZIPs after passing collection and artifact gates.
- Fresh local backup recovery restores retained releases, deliberately rolls back to smaller catalogues and restores the current pointer. No production writes, licence requests, deployment, catalogue publication or real message delivery.

## Deployment remaining

Merge does not deploy the Worker or change R2. Deploy the updated Worker with existing secrets/bindings and the three-origin setting, then publish a freshly built eight-pack gallery release using the expected live release guard. Finally test embedding from the actual development website. The six-pack rehearsal under the earlier gallery evidence is historical and must not be promoted.
