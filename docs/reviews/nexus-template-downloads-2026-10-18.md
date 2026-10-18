# Local Nexus template delivery review — 18 October 2026

Scope: the Nexus v2.7.0 signed-grant adapter, explicit WordPress premium download
transport, private pack/media publication preparation, and Cloudflare preparation documentation.
No templates, renderer or campaign configuration changed. Fresh scoped approvals
and the derived bundled collection index were recorded in the follow-up review.
No remote deployment, credentials, customer messages, CI or merge was performed.

## Follow-up merge review

The local adapter findings are resolved. Grant issuance and file delivery now
have independent retry backoff, with concurrent-transport and file-backoff
regressions. Managed-key refusals consistently direct the administrator to the
licence manager; six refusal cases are covered. Ordinary customer guidance is
preserved. ADR 0082 and the discovery API introduction now describe the actual
transport and authorization boundaries. Independent spec and standards reviews
found no remaining must-fix code findings.

The deployment guide and Wrangler configuration use **WConvert Template Library**,
Worker `wconvert-template-api`, buckets `wconvert-templates-public` and
`wconvert-templates-private`, and one hosted prelaunch environment. Both buckets
remain private. No infrastructure or credentials were created.

The inherited approval blocker was addressed through a fresh review of the 24
setups used by all six bundled collections, rather than bypassing the gate.
See [current evidence](collection-approvals-2026-10-18/README.md). The 104 other
setup reviews remain stale and are outside this release dependency set. The
post-publication and packaging results are recorded in that directory's
`release-results.md` after completion. No merge or deployment is authorized by
these local checks.

## Results

| Check | Result |
| --- | --- |
| `npm run check --prefix tools/template-server` | Passed generated Worker types and TypeScript |
| `npm test --prefix tools/template-server` | 19 tests passed in actual Workerd/R2/WebCrypto runtime, with test-only Nexus responses |
| `vendor/bin/phpunit` | 3,357 tests, 19,106 assertions passed |
| `npm test -- --maxWorkers=2` | 254 files, 4,469 tests passed |
| `npm run typecheck` | Passed |
| `composer phpstan` | Passed |
| `node --test tools/design-library/build/publisher.test.mjs tools/design-library/build/download-service.test.mjs` | 9 passed |
| `npm run test:wordpress --prefix tools/template-server` | Passed on WordPress 7.1.3 / PHP 8.1.34 |
| `npm run test:template-studio` | 38 passed after approval publication |
| `composer verify:source` | Passed |
| `npm run templates:collections:check` | Passed: six freshly approved collections |
| `bash bin/build.sh all` | Passed: Free and Pro ZIPs, both artifact contracts |
| `git diff --check` | Passed |

The first full JS run had three 5-second timeouts in builder-shell while other
heavy checks were running. That entire file passed separately (67 tests); the
complete suite then passed with two workers. No test timeouts or assertions were
weakened. The native check initially found an escaped-JSON assertion error in its
own image URL check; the assertion now checks the complete local URL and passes.

## Scenarios exercised

- Free/public reads make no Nexus request and carry no credential.
- Missing server configuration and missing customer key fail closed.
- A valid signed grant permits the exact pack and its declared premium images.
- Wrong issuer/audience/environment/store/item/permission/site/resource digest,
  absent activation, altered signatures, wrong algorithms and invalid lifetimes
  cannot authorize downloads.
- GET, HEAD, conditional requests and retries verify access; arbitrary assets,
  private bucket paths, context records and query credentials cannot bypass it.
- Expiry is checked on every file. Unknown passes and lost context are refused.
- Licence expiry, disabled keys and inactive websites remain distinct from
  service configuration problems, 429s and Nexus outages.
- Issued passes can finish during an outage; new passes fail closed.
- Published key rotation works; unknown-key refresh is bounded; unavailable keys
  refuse new access. Redirects, malformed replies and oversized bodies fail closed.
- Plugin credentials go only to a pinned HTTPS API origin; the SDK supplies manual
  and managed keys, and SDK normalization preserves the site's subdirectory.
- The plugin reauthorizes an expired pass only once and honors Retry-After across
  requests. Raw service/transport error details never enter admin messages.
- Private staging verifies the pack/image closure, immutable reuse and read-back;
  private bytes do not enter public storage. Existing publication rollback and
  concurrent-promotion protections still pass.
- Real WordPress container wiring selects the Pro transport. Premium pack/image
  preview and installation work; damaged images do not install a partial pack.
  Expired access refuses a new preview while installed previews work offline with
  zero requests. Admin responses contain neither key nor grant.

## Deliberate remaining work

The native WordPress rehearsal intercepts HTTP, while Worker tests separately use
actual signed test passes. This is not a live WordPress→HTTPS Worker→production
Nexus acceptance test. That requires the prepared domain/buckets/real service key
and authorised test licences, including real local-development/subdirectory/multisite activation cases.

Prepare infrastructure using [the checklist](../../tools/template-server/CLOUDFLARE-SETUP.md).
Authenticated remote publishing, deployment request limits, operational logging,
backup/restore and production rollout remain deployment work. The private bucket
must clean `grants/` contexts through its lifecycle rule; signed expiry is enforced
independently of cleanup. Installed campaigns have no licence/network dependency.
