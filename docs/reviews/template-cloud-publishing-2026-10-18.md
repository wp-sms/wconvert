# Template cloud publication verification — 18 October 2026

Branch: `codex/template-library-cloud-publishing`; base `1feff1952a80a4999092dffa78c87fc5549437b7`.

Initial release: `12e87e0921dccfe0e474d75763fa69def19b2753a6b2f64dfca9af37a3175636`.

Current hosted release: `b956f0d012399019d72341b4752cfd24e3fa6b7484f4d85f26e0c5c4ee9a7858`. The second release changes only the public preview toolbar layout: five new previews and two release records; 12 existing public objects and the private pack reused. Original release retained.

## Actual Cloudflare R2 checks

- Scoped credentials loaded from a private file outside the repository; no secret values printed.
- Initial catalogue was absent. Published 12 immutable public objects, one private pack, then the manifest.
- Separately downloaded all 14 objects and compared exact bytes to the validated local release.
- Confirmed the premium pack is absent from the public bucket.
- Repeated publication with the expected current release: zero new public objects, all 12 reused.
- Attempted publication with stale `--expected none`: refused before upload.
- No deletions, synthetic catalogue replacements, Nexus configuration or site settings changed.

## Local verification

- Worker/publisher suite: 27 passed, including competing publishers, interrupted writes, corruption, retry and retained-release rollback.
- Wrangler generated types and TypeScript check passed.
- Actual release through Workerd/R2 emulation: four Free packs, five public previews, one image, 16 Free setups; premium refused.
- Disposable WordPress 7.1.3 / PHP 8.1.34: four Free packs previewed and installed, 13 designs / 16 setups / two collections available offline. Illustrated update reused artwork and preserved the original snapshot. Unauthorized premium fixture refused.
- Fixed the native verifier to explicitly assert premium refusal when private fixture access is disabled; offline assertions cover only successfully installed packs.

## Live Worker and WordPress acceptance

The operator deployed the Worker/custom domain. The final published release passed:

- Real HTTPS GET, HEAD (identity encoding for length checks), ETag/304 and content hashes for four Free packs, five public previews, release pages and one image. Public previews carry sandbox CSP.
- Premium GET/HEAD and fake Bearer/conditional requests return 503 and private/no-store while Nexus is disconnected. This is deliberate refusal, not licensed acceptance.
- Public writes and OPTIONS rejected with 405. Unknown paths, private bucket paths, premium source under a public pack path and missing objects rejected. Query credentials rejected with 400. Grant issuance stays closed.
- Disposable WordPress 7.1.3 / PHP 8.1.34 used the shipping WpCatalogTransport over real HTTPS: four packs installed, 13 designs / 16 setups, one verified image, premium refused. An intercepted network failure after install confirmed offline preview and archive preservation. Successful HTTP was not mocked; no persistent site settings/campaigns changed.
- Browser spot checks: illustrated Free desktop/mobile/success and premium mobile result. Found and fixed narrow-window overflow in the public screen selector. Confirmed the hosted corrected document has equal scroll/client widths at 597px; the sample uses its 320px mobile mode. This is a preview-shell fix, not a new full template-library visual review.
- Final tooling checks: 29 Worker/publisher/verifier tests and eight public-preview/publication tests passed; TypeScript checks and git diff whitespace checks passed. A regression verifies compressed GETs with identity HEAD, wrong release/digest/length, accidental premium access and missing sandbox rejection.

Screenshot: [corrected hosted toolbar](template-cloud-publishing-2026-10-18/preview-toolbar.png).

## Remaining

Dashboard compatibility date correction: configuration and runtime fixtures now use `2026-10-01`. Type checks, all 27 tests, and the actual release through Workerd/R2 were rerun successfully with that date.

Nexus remains intentionally disconnected; real licensed acceptance is deferred. The plugin default catalogue URL is unset. Request limits, backup restoration and final branch review/merge remain launch work. The operator confirmed bucket privacy/lifecycle and followed the Worker setup; the object-only token cannot independently audit dashboard settings or alternate Worker URLs. Rollback and concurrency were tested locally, not by disrupting the real catalogue.
